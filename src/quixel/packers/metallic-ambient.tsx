import { remove } from "fs-extra";
import { basename, join } from "path";

import * as React from "react";

import { Editor, FilesStore } from "babylonjs-editor";
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
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, metallicTexture: Nullable<Texture>, ambientTexture: Nullable<Texture>, rootFolder: string): Promise<void> {
        if (metallicTexture && ambientTexture) {
            const log = await editor.console.logInfo("Packing ambient texture in metallic texture red channel.");
            const packedMetallicTexturePath = await TextureUtils.MergeTextures(metallicTexture, ambientTexture, rootFolder, (color1, color2) => ({
                r: color2.r,
                g: color1.g,
                b: color1.b,
                a: color1.a,
            }));

            if (packedMetallicTexturePath) {
                metallicTexture!.dispose();
                ambientTexture!.dispose();

                try {
                    await remove(join(rootFolder, basename(ambientTexture.name)));
                    await remove(join(rootFolder, basename(metallicTexture.name)));
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
                material.useAmbientOcclusionFromMetallicTextureRed = true;
            }

            log.setBody(
                <span style={{ display: "block" }}>
                    Packing ambient texture in metallic texture red channel. <span style={{ color: "seagreen" }}>Done</span>
                </span>
			);
        } else {
            material.ambientTexture = ambientTexture!;
        }
    }
}
