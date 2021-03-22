import { Editor, FilesStore, TextureAssets } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import { PBRMaterial, Texture } from "babylonjs";

import { TextureUtils } from "../../tools/textureMerger";

export class AlbedoOpacityPacker {
    /**
     * Packs the given albedo and opacity maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param albedoTexture defines the reference to the albedo texture.
     * @param opacityTexture defines the reference to the opacity texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, albedoTexture: Nullable<Texture>, opacityTexture: Nullable<Texture>): Promise<void> {
        const texturesAssets = editor.assets.getComponent(TextureAssets);
        if (!texturesAssets) {
            return;
        }

        if (albedoTexture && opacityTexture) {
            editor.console.logInfo("Packing opacity texture in albedo texture alpha channel.");
            const packedAlbedoTexturePath = await TextureUtils.MergeTextures(albedoTexture, opacityTexture, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r,
            }));

            if (packedAlbedoTexturePath) {
                albedoTexture!.dispose();
                opacityTexture!.dispose();

                const packedAlbedoTexture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(packedAlbedoTexturePath, editor.scene!, false, true, undefined, () => {
                        texturesAssets.configureTexturePath(texture);
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });

                FilesStore.AddFile(packedAlbedoTexturePath);
                
                material.albedoTexture = packedAlbedoTexture;
                packedAlbedoTexture.hasAlpha = true;
                material.useAlphaFromAlbedoTexture = true;
            }
        } else {
            if (albedoTexture) {
                material.albedoTexture = albedoTexture;
            }

            if (opacityTexture) {
                material.opacityTexture = opacityTexture;
                opacityTexture.getAlphaFromRGB = true;
            }
        }
    }
}
