import { remove } from "fs-extra";
import { basename, join } from "path";

import * as React from "react";

import { Editor, FilesStore } from "babylonjs-editor";
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
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, albedoTexture: Nullable<Texture>, opacityTexture: Nullable<Texture>, rootFolder: string): Promise<void> {
        if (albedoTexture && opacityTexture) {
            const log = await editor.console.logInfo("Packing opacity texture in albedo texture alpha channel.");
            const packedAlbedoTexturePath = await TextureUtils.MergeTextures(albedoTexture, opacityTexture, rootFolder, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r,
            }));

            if (packedAlbedoTexturePath) {
                albedoTexture!.dispose();
                opacityTexture!.dispose();

                try {
                    await remove(join(rootFolder, basename(albedoTexture.name)));
                    await remove(join(rootFolder, basename(opacityTexture.name)));
                } catch (e) {
                    // Catch silently.
                }

                const packedAlbedoTexture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(packedAlbedoTexturePath, editor.scene!, false, true, undefined, () => {
                        texture.name = packedAlbedoTexturePath.replace(join(editor.assetsBrowser.assetsDirectory, "/"), "");;
                        texture.url = texture.name;
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

            log.setBody(
                <span style={{ display: "block" }}>
                    Packing opacity texture in albedo texture alpha channel. <span style={{ color: "seagreen" }}>Done</span>
                </span>
			);
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
