import { remove } from "fs-extra";
import { basename, join } from "path";

import * as React from "react";

import { Editor, FilesStore } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import { PBRMaterial, Texture } from "babylonjs";

import { TextureUtils } from "../../tools/textureMerger";

export class MaskPacker {
	/**
	 * Packs the given reflectivity and microsurface maps.
	 * @param editor defines the reference to the editor.
	 * @param material defines the reference to the material being configured.
	 * @param maskTexture defines the reference to the mask texture.
	 * @param rootFolder defines the root folder where to write the resulted texture.
	 */
	public static async Pack(editor: Editor, material: PBRMaterial, maskTexture: Nullable<Texture>, rootFolder: string): Promise<void> {
		if (maskTexture) {
			const log = await editor.console.logInfo("Packing mask texture alpha channel.");
			const packedMaskTexturePath = await TextureUtils.MergeTextures(maskTexture, maskTexture, rootFolder, (color1) => ({
				r: color1.r,
				g: color1.g,
				b: color1.b,
				a: color1.r,
			}));

			if (packedMaskTexturePath) {
				maskTexture!.dispose();

				try {
                    await remove(join(rootFolder, basename(maskTexture.name)));
                } catch (e) {
                    // Catch silently.
                }

				const packedMaskTexture = await new Promise<Texture>((resolve, reject) => {
					const texture = new Texture(packedMaskTexturePath, editor.scene!, false, true, undefined, () => {
						texture.name = packedMaskTexturePath.replace(join(editor.assetsBrowser.assetsDirectory, "/"), "");;
						texture.url = texture.name;
						texture.hasAlpha = true;
						resolve(texture);
					}, (_, e) => {
						reject(e);
					});
				});

				FilesStore.AddFile(packedMaskTexturePath);

				material.albedoTexture = packedMaskTexture;
				material.useAlphaFromAlbedoTexture = false;
			} else {
				material.albedoTexture = maskTexture;
			}

			log.setBody(
                <span style={{ display: "block" }}>
					Packing mask texture alpha channel. <span style={{ color: "seagreen" }}>Done</span>
                </span>
			);
		}
	}
}