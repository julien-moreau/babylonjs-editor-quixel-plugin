import { Editor, FilesStore, TextureAssets } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import { PBRMaterial, Texture } from "babylonjs";

import { TextureUtils } from "../../tools/textureMerger";

export class MetallicRoughnessPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param metallicTexture defines the reference to the metallic texture.
     * @param roughnessTexture defines the reference to the roughness texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, metallicTexture: Nullable<Texture>, roughnessTexture: Nullable<Texture>): Promise<void> {
        const texturesAssets = editor.assets.getComponent(TextureAssets);
        if (!texturesAssets) {
            return;
        }

        if (metallicTexture && roughnessTexture) {
            editor.console.logInfo("Packing roughness texture in metallic texture green channel.");
            const packedMetallicTexturePath = await TextureUtils.MergeTextures(metallicTexture, roughnessTexture, (color1, color2) => ({
                r: 0,
                g: color2.r,
                b: color1.r,
                a: 255,
            }));

            if (packedMetallicTexturePath) {
                metallicTexture!.dispose();
                roughnessTexture!.dispose();

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
                material.metallic = 1;
                material.roughness = 1;
                material.useRoughnessFromMetallicTextureAlpha = false;
                material.useRoughnessFromMetallicTextureGreen = true;
                material.useMetallnessFromMetallicTextureBlue = true;
            }
        } else if (metallicTexture) {
            material.metallicTexture = metallicTexture;
            material.metallic = 1;
            material.roughness = 0;
            material.useRoughnessFromMetallicTextureAlpha = false;
            material.useRoughnessFromMetallicTextureGreen = false;
            material.useMetallnessFromMetallicTextureBlue = true;
        } else if (roughnessTexture) {
            material.metallicTexture = roughnessTexture;
            material.metallic = 0;
            material.roughness = 1;
            material.useRoughnessFromMetallicTextureAlpha = false;
            material.useRoughnessFromMetallicTextureGreen = true;
            material.useMetallnessFromMetallicTextureBlue = false;
        }
    }
}