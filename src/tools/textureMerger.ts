import { writeFile } from "fs-extra";
import { basename, extname, join } from "path";

import { Project, Tools } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import { Tools as BabylonTools, Texture, ISize, TextureTools } from "babylonjs";
import { WorkerTools } from "./workers";

export interface IMergedColor {
    /**
     * Defines the value of the red channel for the pixel.
     */
    r: number;
    /**
     * Defines the value of the green channel for the pixel.
     */
    g: number;
    /**
     * Defines the value of the blue channel for the pixel.
     */
    b: number;
    /**
     * Defines the value of the alpha channel for the pixel.
     */
    a: number;
}

export class TextureUtils {
    /**
     * Merges the two given textures to the desized format.
     * @param a defines the reference to the first texture.
     * @param b defines the reference to the second texture.
     * @param rootFolder defines the root folder where to write the texture.
     * @param callback defines the callback called for each pixel that returns the final merged color.
     */
    public static async MergeTextures(a: Texture, b: Texture, rootFolder: string, callback: (color1: IMergedColor, color2: IMergedColor) => IMergedColor): Promise<Nullable<string>> {
        if (!Project.DirPath) {
            return null;
        }

        const aSize = a.getSize();
        const bSize = b.getSize();
        if (aSize.width !== bSize.width || aSize.height !== bSize.height) {
            return null;
        }

        const aBuffer = (await a.readPixels())?.buffer;
        if (!aBuffer) { return null; }

        const bBuffer = (await b.readPixels())?.buffer;
        if (!bBuffer) { return null; }

        const aPixels = new Uint8ClampedArray(aBuffer);
        const bPixels = new Uint8ClampedArray(bBuffer);

        if (aPixels.length !== bPixels.length) { return null; }

        const worker = await WorkerTools.AddWorker("textureMerger.js");
        const result = await WorkerTools.Compute<number[]>(worker, "compute", {
            aPixels,
            bPixels,
            callback: `return ${callback.toString()}`,
        });

        worker.terminate();

        const blob = await this._ConvertPixelsToBlobImage(aSize, new Uint8ClampedArray(result));
        if (!blob) {
            return null;
        }

        const name = `${basename(a.name).replace(extname(a.name), "")}_${basename(b.name).replace(extname(b.name), "")}.png`;
        const dest = join(rootFolder, name);

        await writeFile(dest, Buffer.from(await Tools.ReadFileAsArrayBuffer(blob)));

        return dest;
    }

    /**
     * Resizes the given texture to target a size of 1024x1024.
     * @param texture defines the reference to the texture to resize.
     */
    public static async ResizeTexture(texture: Texture): Promise<Texture> {
        const resizedTexture = TextureTools.CreateResizedCopy(texture, 1024, 1024, true);
        
        while (!resizedTexture.isReady()) {
            await Tools.Wait(150);
        }

        return resizedTexture;
    }

    /**
     * Converts the given texture to a readable png blob.
     * @param texture defines the reference to the texture to convert ot a png blob.
     */
    public static async GetTextureBlob(texture: Texture): Promise<Nullable<Blob>> {
        const buffer = (await texture.readPixels())?.buffer;
        if (!buffer) { return null; }

        const pixels = new Uint8ClampedArray(buffer);

        return this._ConvertPixelsToBlobImage(texture.getSize(), pixels);
    }

    /**
     * Converts the given pixels to a readable blob image.
     */
    private static async _ConvertPixelsToBlobImage(size: ISize, pixels: Uint8ClampedArray): Promise<Nullable<Blob>> {
        // Base canvas
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;

        const context = canvas.getContext("2d");
        if (!context) { return null; }

        const imageData = new ImageData(pixels, canvas.width, canvas.height);
        context.putImageData(imageData, 0, 0);

        // Final canvas
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = size.width;
        finalCanvas.height = size.height;

        const finalContext = finalCanvas.getContext("2d");
        if (!finalContext) { return null; }
        finalContext.transform(1, 0, 0, -1, 0, canvas.height);
        finalContext.drawImage(canvas, 0, 0);

        const blob = await this._CanvasToBlob(finalCanvas);

        context.restore();
        finalContext.restore();
        canvas.remove();
        finalCanvas.remove();

        return blob;
    }

    /**
     * Converts the given canvas data to blob.
     */
    private static async _CanvasToBlob(canvas: HTMLCanvasElement): Promise<Nullable<Blob>> {
        return new Promise<Nullable<Blob>>((resolve) => {
            BabylonTools.ToBlob(canvas, b => resolve(b));
        });
    }
}
