import { Editor, FilesStore, TextureAssets } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import { PBRMaterial, Texture } from "babylonjs";

import { TextureUtils } from "../../tools/textureMerger";

export class MetallicAmbientPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param metallicTexture defines the reference to the metallic texture.
     * @param roughnessTexture defines the reference to the roughness texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, metallicTexture: Nullable<Texture>, ambientTexture: Nullable<Texture>): Promise<void> {
        const texturesAssets = editor.assets.getComponent(TextureAssets);
        if (!texturesAssets) {
            return;
        }

        if (metallicTexture && ambientTexture) {
            editor.console.logInfo("Packing ambient texture in metallic texture red channel.");
            const packedMetallicTexturePath = await TextureUtils.MergeTextures(metallicTexture, ambientTexture, (color1, color2) => ({
                r: color2.r,
                g: color1.g,
                b: color1.b,
                a: color1.a,
            }));

            if (packedMetallicTexturePath) {
                metallicTexture!.dispose();
                ambientTexture!.dispose();

                const packedMetallicTexture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(packedMetallicTexturePath, editor.scene!, false, true, undefined, () => {
                        texturesAssets.configureTexturePath(texture);
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });

                FilesStore.AddFile(packedMetallicTexturePath);
                
                material.metallicTexture = packedMetallicTexture;
                material.useAmbientOcclusionFromMetallicTextureRed = true;
            }
        } else {
            material.ambientTexture = ambientTexture!;
        }
    }
}
