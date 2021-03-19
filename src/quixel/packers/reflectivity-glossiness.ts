import { Editor, FilesStore, TextureAssets } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import { PBRMaterial, Texture } from "babylonjs";

import { TextureUtils } from "../../tools/textureMerger";

export class ReflectivityGlossinessPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param reflectivityTexture defines the reference to the reflectivity texture.
     * @param microSurfaceTexture defines the reference to the microsurface texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, reflectivityTexture: Nullable<Texture>, microSurfaceTexture: Nullable<Texture>): Promise<void> {
        const texturesAssets = editor.assets.getComponent(TextureAssets);
        if (!texturesAssets) {
            return;
        }

        if (reflectivityTexture && microSurfaceTexture) {
            editor.console.logInfo("Packing micro surface texture in reflectivity texture alpha channel.");
            const packedReflectivityTexturePath = await TextureUtils.MergeTextures(reflectivityTexture, microSurfaceTexture, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r,
            }));

            if (packedReflectivityTexturePath) {
                reflectivityTexture!.dispose();
                microSurfaceTexture!.dispose();

                const packedReflectivityTexture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(packedReflectivityTexturePath, editor.scene!, false, true, undefined, () => {
                        texturesAssets.configureTexturePath(texture);
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });

                FilesStore.AddFile(packedReflectivityTexturePath);
                
                material.reflectivityTexture = packedReflectivityTexture;
                material.useMicroSurfaceFromReflectivityMapAlpha = true;
            }
        } else {
            material.reflectivityTexture = reflectivityTexture!;
            material.microSurfaceTexture = microSurfaceTexture!;
        }
    }
}