import { remove } from "fs-extra";
import { basename, join } from "path";

import * as React from "react";

import { Editor, FilesStore } from "babylonjs-editor";
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
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    public static async Pack(editor: Editor, material: PBRMaterial, reflectivityTexture: Nullable<Texture>, microSurfaceTexture: Nullable<Texture>, rootFolder: string): Promise<void> {
        if (reflectivityTexture && microSurfaceTexture) {
            const log = await editor.console.logInfo("Packing micro surface texture in reflectivity texture alpha channel.");
            const packedReflectivityTexturePath = await TextureUtils.MergeTextures(reflectivityTexture, microSurfaceTexture, rootFolder, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r,
            }));

            if (packedReflectivityTexturePath) {
                reflectivityTexture!.dispose();
                microSurfaceTexture!.dispose();

                try {
                    await remove(join(rootFolder, basename(reflectivityTexture.name)));
                    await remove(join(rootFolder, basename(microSurfaceTexture.name)));
                } catch (e) {
                    // Catch silently.
                }

                const packedReflectivityTexture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(packedReflectivityTexturePath, editor.scene!, false, true, undefined, () => {
                        texture.name = packedReflectivityTexturePath.replace(join(editor.assetsBrowser.assetsDirectory, "/"), "");;
                        texture.url = texture.name;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });

                FilesStore.AddFile(packedReflectivityTexturePath);
                
                material.reflectivityTexture = packedReflectivityTexture;
                material.useMicroSurfaceFromReflectivityMapAlpha = true;
            }

            log.setBody(
                <span style={{ display: "block" }}>
                    Packing micro surface texture in reflectivity texture alpha channel. <span style={{ color: "seagreen" }}>Done</span>
                </span>
			);
        } else {
            material.reflectivityTexture = reflectivityTexture!;
            material.microSurfaceTexture = microSurfaceTexture!;
        }
    }
}