import { remove } from "fs-extra";
import { basename, join } from "path";

import * as React from "react";

import { Editor, FilesStore, TextureAssets } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import { PBRMaterial, Texture } from "babylonjs";

import { preferences } from "../preferences";
import { TextureUtils } from "../../tools/textureMerger";

export class NormalDisplacementPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param bumpTexture defines the reference to the reflectivity texture.
     * @param displacementTexture defines the reference to the microsurface texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, bumpTexture: Nullable<Texture>, displacementTexture: Nullable<Texture>, rootFolder: string): Promise<void> {
        const texturesAssets = editor.assets.getComponent(TextureAssets);
        if (!texturesAssets) {
            return;
        }

        if (bumpTexture && displacementTexture && preferences.convertDisplacementToParallax) {
            const log = await editor.console.logInfo("Packing displacement texture in bump texture alpha channel to use parallax mapping.");
            const packedBumpTexturePath = await TextureUtils.MergeTextures(bumpTexture, displacementTexture, rootFolder, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r < 128 ? 128 : 255,
            }));

            if (packedBumpTexturePath) {
                bumpTexture!.dispose();
                displacementTexture!.dispose();

                try {
                    await remove(join(rootFolder, basename(bumpTexture.name)));
                    await remove(join(rootFolder, basename(displacementTexture.name)));
                } catch (e) {
                    // Catch silently.
                }

                const packedBumpTexture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(packedBumpTexturePath, editor.scene!, false, true, undefined, () => {
                        texture.name = packedBumpTexturePath.replace(join(editor.assetsBrowser.assetsDirectory, "/"), "");;
                        texture.url = texture.name;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });

                FilesStore.AddFile(packedBumpTexturePath);
                
                material.bumpTexture = packedBumpTexture;
                material.useParallax = true;
                material.useParallaxOcclusion = true;
                material.parallaxScaleBias = -0.01;
            }

            log.setBody(
                <span style={{ display: "block" }}>
                    Packing displacement texture in bump texture alpha channel to use parallax mapping. <span style={{ color: "seagreen" }}>Done</span>
                </span>
			);
        } else {
            material.bumpTexture = bumpTexture!;
        }
    }
}