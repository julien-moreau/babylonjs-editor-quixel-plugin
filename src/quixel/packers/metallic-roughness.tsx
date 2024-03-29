import { remove } from "fs-extra";
import { basename, join } from "path";

import * as React from "react";

import { Editor, FilesStore } from "babylonjs-editor";
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
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, metallicTexture: Nullable<Texture>, roughnessTexture: Nullable<Texture>, rootFolder: string): Promise<void> {
        if (metallicTexture && roughnessTexture) {
            const log = await editor.console.logInfo("Packing roughness texture in metallic texture green channel.");
            const packedMetallicTexturePath = await TextureUtils.MergeTextures(metallicTexture, roughnessTexture, rootFolder, (color1, color2) => ({
                r: 0,
                g: color2.r,
                b: color1.r,
                a: 255,
            }));

            if (packedMetallicTexturePath) {
                metallicTexture!.dispose();
                roughnessTexture!.dispose();

                try {
                    await remove(join(rootFolder, basename(metallicTexture.name)));
                    await remove(join(rootFolder, basename(roughnessTexture.name)));
                } catch (e) {
                    // Catch silently.
                }

                const packedMetallicTexture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(packedMetallicTexturePath, editor.scene!, false, true, undefined, () => {
                        texture.name = packedMetallicTexturePath.replace(join(editor.assetsBrowser.assetsDirectory, "/"), "");;
                        texture.url = texture.name;
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

            log.setBody(
                <span style={{ display: "block" }}>
                    Packing roughness texture in metallic texture green channel. <span style={{ color: "seagreen" }}>Done</span>
                </span>
			);
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