import { extname, join } from "path";
import { copyFile, readFile, writeFile } from "fs-extra";

import { Editor, Tools, Project, FilesStore, TextureAssets } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import {
    Mesh, VertexData, Geometry, Vector3, Space,
    PBRMaterial, Texture, Quaternion,
} from "babylonjs";

import { QuixelServer } from "./server";
import { IQuixelExport, IQuixelLOD } from "./types";
import { preferences } from "./preferences";

import { FBXLoader } from "../fbx/loader";

import { TextureUtils } from "../tools/textureMerger";

import { MetallicAmbientPacker } from "./packers/metallic-ambient";
import { MetallicRoughnessPacker } from "./packers/metallic-roughness";
import { ReflectivityGlossinessPacker } from "./packers/reflectivity-glossiness";

export interface IParsedMesh {
    /**
     * Defines the index of the meshes in the avaialbe meshes variations.
     */
    index: number;
    /**
     * Defines the reference to the list of meshes for the current variation.
     */
    meshes: { index: number; mesh: Mesh }[];
}

export class QuixelListener {
    private static _Instance: Nullable<QuixelListener> = null;

    /**
     * Inits the listener used to compute Quixel Bridge commands.
     * @param editor defines the reference to the editor.
     */
    public static Init(editor: Editor): QuixelListener {
        this._Instance ??= new QuixelListener(editor);
        return this._Instance;
    }

    private static _SupportedTexturesTypes: string[] = [
        "albedo", "normal", "specular",
        "gloss", "ao", "metalness",
        "opacity", "roughness",
        "translucency",
    ];

    private _editor: Editor;
    private _queue: IQuixelExport[] = [];

    /**
     * Constructor.
     * @param editor defines the reference to the editor.
     */
    private constructor(editor: Editor) {
        this._editor = editor;

        QuixelServer.OnExportedAssetObservable.add((e) => {
            this._handleAssetExported(e);
        });
    }

    /**
     * Called on an assets has been exported from Quixel Bridge.
     */
    private async _handleAssetExported(exports: IQuixelExport[]): Promise<void> {
        while (this._queue.length) {
            await Tools.Wait(150);
        }

        const task = this._editor.addTaskFeedback(0, "");

        // Add all exports to the queue
        exports.forEach((e) => this._queue.push(e));

        // Copy textures
        this._editor.updateTaskFeedback(task, 0, "Quixel: Copying textures...");
        this._editor.console.logSection("Quixel: Copy textures");
        await Promise.all(this._queue.map((q) => this._copyTextures(q)));
        this._editor.updateTaskFeedback(task, 20);

        // Handle exports
        const step = 80 / this._queue.length;
        let feedbackStep = 20;

        this._editor.console.logSection("Quixel: Handle export");
        this._editor.updateTaskFeedback(task, feedbackStep, "Quixel: Handling exports...");
        await Promise.all(this._queue.map((q) => this._handleExport(q).then(() => {
            this._editor.updateTaskFeedback(task, feedbackStep += step);
        })));

        // Notify done
        this._editor.updateTaskFeedback(task, 100, "Done!");
        this._editor.closeTaskFeedback(task, 1000);

        // Refresh assets
        await this._editor.assets.refresh();

        // Empty queue
        this._queue.splice(0, this._queue.length);
    }

    /**
     * Copies all the textures of the given quixel export.
     */
    private async _copyTextures(json: IQuixelExport): Promise<void> {
        if (!Project.DirPath) {
            return;
        }

        const components = json.components.filter((c) => QuixelListener._SupportedTexturesTypes.indexOf(c.type) !== -1);
        const promises = components.map(async (c) => {
            // Simply copy?
            if (c.type === "albedo" || !preferences.useOnlyAlbedoAsHigherQuality) {
                const path = join(Project.DirPath!, "files", c.name);
                
                await copyFile(c.path, path);
                FilesStore.AddFile(path);

                return this._editor.console.logInfo(`Copied texture "${c.name}" at ${path}`);
            }

            // Resize to lower resolution
            try {
                const texture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(c.path, this._editor.scene!, false, true, undefined, () => {
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });

                const resizedTexture = await TextureUtils.ResizeTexture(texture);
                const resizedTextureBlob = await TextureUtils.GetTextureBlob(resizedTexture);

                texture.dispose();
                resizedTexture.dispose();

                if (resizedTextureBlob) {
                    const replacedName = c.name.replace(extname(c.name), ".png");
                    c.name = replacedName;

                    const path = join(Project.DirPath!, "files", replacedName);

                    await writeFile(path, Buffer.from(await Tools.ReadFileAsArrayBuffer(resizedTextureBlob)));
                    FilesStore.AddFile(path);

                    this._editor.console.logInfo(`Copied resized texture "${c.name}" at ${path}`);
                }
            } catch (e) {
                // Catch silently.
            }
        });

        await Promise.all(promises);
    }

    /**
     * Called to handle the given json export according to its type.
     */
    private async _handleExport(json: IQuixelExport): Promise<void> {
        // A material exists in any cases
        const material = await this._createMaterial(json);

        switch (json.type) {
            case "3d":
                await this._handle3dExport(json, material);
                break;

            case "3dplant":
                await this._hande3dPlantExport(json, material);
                break;
        }
    }

    /**
     * Handles exports of type "3d" (3d assets).
     */
    private async _handle3dExport(json: IQuixelExport, material: PBRMaterial): Promise<void> {
        const meshes = await this._createMeshes(json.name, json.lodList);
        meshes.forEach((m) => m.material = material);
    }

    /**
     * Handles exports of type "3dplant" (3d plants).
     */
    private async _hande3dPlantExport(json: IQuixelExport, material: PBRMaterial): Promise<void> {
        const variations: IQuixelLOD[][] = [];
        json.lodList.forEach((lod) => {
            if (lod.variation === undefined) {
                return;
            }

            const index = lod.variation - 1;
            if (!variations[index]) {
                variations.push([]);
            }

            variations[index].push(lod);
        });

        const variationsMeshes = await Promise.all(variations.map((v, index) => this._createMeshes(`${json.name}-var${index + 1}`, v)));
        variationsMeshes.forEach((variationMeshes) => {
            variationMeshes.forEach((m) => m.material = material);
        });
    }

    /**
     * Creates all the meshes including their LODs.
     */
    private async _createMeshes(name: string, lodList: IQuixelLOD[]): Promise<Mesh[]> {
        const parsedMeshes: IParsedMesh[] = [];

        const promises = lodList.map(async (lod, lodIndex) => {
            const content = await readFile(lod.path);
            if (!FBXLoader.IsValidFBX(content)) {
                return this._editor.console.logWarning(`Can't parse FBX file "${lod.lodObjectName}": not valid file.`);;
            }

            const loader = new FBXLoader(content);
            const geometries = loader.parse();

            if (!geometries?.length) {
                return this._editor.console.logWarning(`Mesh "${lod.lodObjectName}" has no geometry. Skipping.`);
            }

            geometries.forEach((g, geometryIndex) => {
                let variation = parsedMeshes.find((pm) => pm.index === geometryIndex);
                if (!variation) {
                    parsedMeshes.push(variation = { index: geometryIndex, meshes: [] });
                }

                const mesh = new Mesh(lod.lodObjectName, this._editor.scene!);
                mesh.scaling.setAll(preferences.objectScale);
                mesh.rotate(new Vector3(1, 0, 0), -Math.PI * 0.5, Space.LOCAL);
                mesh.id = Tools.RandomId();
                mesh.isPickable = false;
                mesh.receiveShadows = true;
                mesh.checkCollisions = false;
                mesh.metadata = {
                    isFromQuixel: true,
                    lodDistance: preferences.lodDistance,
                };

                const vertexData = new VertexData();
                vertexData.positions = g.positions;
                vertexData.indices = g.indices ?? null;
                vertexData.normals = g.normals ?? [];
                vertexData.uvs = g.uvs ?? [];

                const geometry = new Geometry(Tools.RandomId(), this._editor.scene!, vertexData, false);
                geometry.applyToMesh(mesh);

                variation.meshes.push({ index: lodIndex, mesh });

                this._editor.console.logInfo(`Created mesh "${lod.lodObjectName}"`);
            });
        });

        await Promise.all(promises);

        // Sort meshes.
        parsedMeshes.sort((a, b) => a.index - b.index);
        parsedMeshes.forEach((pm) => {
            pm.meshes.sort((a, b) => a.index - b.index);
        });

        // Configure meshes
        parsedMeshes.forEach((pm, pmIndex) => {
            pm.meshes.forEach((m, index) => {
                if (index === 0) {
                    m.mesh.name = name;
                    m.mesh.scaling.scale(preferences.objectScale);

                    if (preferences.checkCollisions && !preferences.checkColiisionsOnLowerLod) {
                        m.mesh.checkCollisions = true;
                    }

                    return this._editor.scene!.lights.forEach((l) => {
                        l.getShadowGenerator()?.getShadowMap()?.renderList?.push(m.mesh);
                    });
                }

                parsedMeshes[pmIndex].meshes[0].mesh.addLODLevel(preferences.lodDistance * index, m.mesh);

                if (preferences.checkCollisions && preferences.checkColiisionsOnLowerLod && index === parsedMeshes.length - 1) {
                    m.mesh.metadata ??= { };
                    m.mesh.metadata.keepGeometryInline = true;

                    const collisionsInstance = m.mesh.createInstance("collisionsInstance");
                    collisionsInstance.checkCollisions = true;
                    collisionsInstance.parent = parsedMeshes[pmIndex].meshes[0].mesh;
                    collisionsInstance.isVisible = false;
                    collisionsInstance.id = Tools.RandomId();
                    collisionsInstance.rotationQuaternion = Quaternion.Identity();
                }
            });
        });

        // Refresh graph
        this._editor.graph.refresh();

        const result: Mesh[] = [];
        parsedMeshes.forEach((pm) => {
            pm.meshes.forEach((m) => result.push((m.mesh)));
        });

        return result;
    }

    /**
     * Creates the material acording to the given json configuration.
     */
    private async _createMaterial(json: IQuixelExport): Promise<PBRMaterial> {
        const material = new PBRMaterial(json.name, this._editor.scene!);
        material.invertNormalMapX = true;
        material.invertNormalMapY = true;

        if (!Project.DirPath) {
            return material;
        }

        const texturesAssets = this._editor.assets.getComponent(TextureAssets);
        if (!texturesAssets) {
            return material;
        }

        let reflectivityTexture: Nullable<Texture> = null;
        let microSurfaceTexture: Nullable<Texture> = null;

        let metallicTexture: Nullable<Texture> = null;
        let roughnessTexture: Nullable<Texture> = null;

        let aoTexture: Nullable<Texture> = null;

        const components = json.components.filter((c) => QuixelListener._SupportedTexturesTypes.indexOf(c.type) !== -1);
        const promises = components.map(async (c) => {
            const path = join("files", c.name);
            let texture: Texture;

            try {
                texture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(join(Project.DirPath!, path), this._editor.scene!, false, true, undefined, () => {
                        texturesAssets.configureTexturePath(texture);
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });
            } catch (e) {
                return;
            }

            switch (c.type) {
                case "albedo": material.albedoTexture = texture; break;
                case "normal": material.bumpTexture = texture; break;

                case "specular": reflectivityTexture = texture; break;
                case "gloss": microSurfaceTexture = texture; break;
                case "metalness": metallicTexture = texture; break;
                case "roughness": roughnessTexture = texture; break;
                case "ao": aoTexture = texture; break;

                case "opacity":
                    material.opacityTexture = texture;
                    texture.getAlphaFromRGB = true;
                    break;

                case "translucency":
                    material.subSurface.isTranslucencyEnabled = true;
                    material.subSurface.thicknessTexture = texture;
                    break;
            }
        });

        await Promise.all(promises);

        // Pack textures
        await Promise.all([
            ReflectivityGlossinessPacker.Pack(this._editor, material, reflectivityTexture, microSurfaceTexture),
            MetallicRoughnessPacker.Pack(this._editor, material, metallicTexture, roughnessTexture),
        ]);

        // Pack ao with metal
        await MetallicAmbientPacker.Pack(this._editor, material, material.metallicTexture as Texture, aoTexture);

        // Add metadata
        if (json.type === "surface") {
            material.metadata = {
                isFromQuixel: true,
            };
        }
        
        return material;
    }
}
