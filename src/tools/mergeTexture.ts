import { tmpdir } from "os";
import { basename, join } from "path";
import { writeFile, remove, rmdir, mkdtemp } from "fs-extra";

import { Editor, Tools } from "babylonjs-editor";
import { BaseTexture, Nullable, Tools as BabylonTools } from "babylonjs";

export class TextureMergeTools {
    /**
     * Merges the given diffuse texture with the given opacity texture.
     * @param editor defines the editor reference.
     * @param displacement defines the diffuse texture reference.
     * @param normal defines the opacity texture reference.
     */
    public static async MergeDisplacementWithNormal(editor: Editor, displacement: BaseTexture, normal: BaseTexture): Promise<Nullable<string>> {
        const displacementSize = displacement.getSize();
        const normalSize = normal.getSize();

        if (displacementSize.width !== normalSize.width || displacementSize.height !== normalSize.height) {
            return null;
        }

        const displacementBuffer = displacement.readPixels()?.buffer;
        if (!displacementBuffer) { return null; }

        const normalBufferBuffer = normal.readPixels()?.buffer;
        if (!normalBufferBuffer) { return null; }

        const displacementPixels = new Uint8ClampedArray(displacementBuffer);
        const normalPixels = new Uint8ClampedArray(normalBufferBuffer);

        for (let i = 0; i < displacementPixels.length; i+= 4) {
            normalPixels[i + 3] = (displacementPixels[i] < 128) ? displacementPixels[i] * 0.5 : displacementPixels[i];
        }

        return this.ConvertPixelsToTextureFile(editor, displacement, normal, normalPixels);
    }

    /**
     * Converts the given pixels to a texture file.
     */
    public static async ConvertPixelsToTextureFile(editor: Editor, textureA: BaseTexture, textureB: BaseTexture, pixels: Uint8ClampedArray): Promise<Nullable<string>> {
        // Base canvas
        const canvas = document.createElement("canvas");
        canvas.width = textureA.getBaseSize().width;
        canvas.height = textureA.getBaseSize().height;

        const context = canvas.getContext("2d");
        if (!context) { return null; }

        const imageData = new ImageData(pixels, canvas.width, canvas.height);
        context.putImageData(imageData, 0, 0);

        // Final canvas
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = textureA.getBaseSize().width;
        finalCanvas.height = textureA.getBaseSize().height;

        const finalContext = finalCanvas.getContext("2d");
        if (!finalContext) { return null; }
        finalContext.transform(1, 0, 0, -1, 0, canvas.height);
        finalContext.drawImage(canvas, 0, 0);

        const name = `${basename(textureA.name).split(".")[0]}_${basename(textureB.name).split(".")[0]}.png`;
        const blob = await this._CanvasToBlob(finalCanvas);

        context.restore();
        finalContext.restore();
        canvas.remove();
        finalCanvas.remove();

        if (!blob) { return null; }

        // Write the temp file
        const tempDir = await mkdtemp(join(tmpdir(), "babylonjs-quixel-editor"));
        const textureDest = join(tempDir, name);

        await writeFile(textureDest, Buffer.from(await Tools.ReadFileAsArrayBuffer(blob)));

        // Add to assets
        await editor.assets.addFilesToAssets([{ path: textureDest, name }]);
        
        // Remove temp stuff
        try {
            await remove(textureDest);
            await rmdir(tempDir);
        } catch (e) {
            console.error("Failed to remove tmp dir", e);
        }
        
        editor.inspector.refreshDisplay();

        return name;
    }

    /**
     * Converts the given canvas data to blob.
     */
    private static async _CanvasToBlob (canvas: HTMLCanvasElement): Promise<Nullable<Blob>> {
        return new Promise<Nullable<Blob>>((resolve) => {
            BabylonTools.ToBlob(canvas, b => resolve(b));
        });
    }
}