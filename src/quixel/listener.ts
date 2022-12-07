import { basename, dirname, extname, join } from "path";
import { copyFile, writeFile, writeJSON } from "fs-extra";

import { Editor, Tools, Project, FSTools, MeshExporter } from "babylonjs-editor";
import { Nullable } from "babylonjs-editor/shared/types";

import {
    Mesh, Vector3, SceneLoader, PBRMaterial, Texture, Quaternion, Observable,
    NodeMaterial, CopyTools, BaseTexture, Material,
} from "babylonjs";

import { QuixelServer } from "./server";
import { IQuixelComponent, IQuixelExport, IQuixelLOD } from "./types";
import { preferences } from "./preferences";

import { TextureUtils } from "../tools/textureMerger";

import plantMaterialJson from "./materials/plants.json";

import { MaskPacker } from "./packers/mask";
import { AlbedoOpacityPacker } from "./packers/albedo-opacity";
import { MetallicAmbientPacker } from "./packers/metallic-ambient";
import { MetallicRoughnessPacker } from "./packers/metallic-roughness";
import { NormalDisplacementPacker } from "./packers/normal-displacement";
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

export interface IMaterialOptions {
    /**
     * Defines the reference to the displacement component's json.
     */
    displacement?: IQuixelComponent;
    /**
     * Defines the list of all texture sets.
     */
    textureSets?: string[];
}

export class QuixelListener {
    private static _Instance: Nullable<QuixelListener> = null;

    /**
     * Defines the list of all imported assets.
     */
    public static ImportedAssets: IQuixelExport[] = [];

    /**
     * Inits the listener used to compute Quixel Bridge commands.
     * @param editor defines the reference to the editor.
     */
    public static Init(editor: Editor): QuixelListener {
        if (this._Instance) {
            return this._Instance;
        }

        this._Instance = new QuixelListener(editor);
        return this._Instance;
    }

    /**
     * Returns the instance of the listener.
     */
    public static GetInstance(): QuixelListener {
        return this._Instance!;
    }

    private static _SupportedTexturesTypes: string[] = [
        "albedo", "normal", "specular",
        "gloss", "ao", "metalness",
        "opacity", "roughness", "mask",
        "translucency", "displacement",

        "brush",
    ];

    private _editor: Editor;
    private _queue: IQuixelExport[] = [];

    /**
     * Defines the reference to the observable used to notify observers that a new quixel asset has
     * been parsed and imported to the scene.
     */
    public onAssetImportedObservable: Observable<IQuixelExport> = new Observable<IQuixelExport>();

    /**
     * Constructor.
     * @param editor defines the reference to the editor.
     */
    private constructor(editor: Editor) {
        this._editor = editor;

        QuixelServer.OnExportedAssetObservable.add((e) => {
            this.importAssets(e, preferences.automaticallyAddToScene ?? true);
        });
    }

    /**
     * Called on an assets has been exported from Quixel Bridge.
     */
    public async importAssets(exports: IQuixelExport[], addToScene: boolean, atPosition?: Vector3): Promise<void> {
        while (this._queue.length) {
            await Tools.Wait(150);
        }

        // Check quixel folder
        await FSTools.CreateDirectory(join(this._editor.assetsBrowser.assetsDirectory, "quixel"));

        // Add task
        const task = this._editor.addTaskFeedback(0, "");

        // Add all exports to the queue
        exports.forEach((e) => this._queue.push(e));

        if (addToScene) {
            // Copy textures
            this._editor.updateTaskFeedback(task, 0, "Quixel: Copying textures...");
            this._editor.console.logSection("Quixel: Copy textures");

            for (const q of this._queue) {
                await this._createAssetsDirectories(q);
            }

            await Promise.all(this._queue.map((q) => this._copyTextures(q)));
            this._editor.updateTaskFeedback(task, 20);

            // Handle exports
            const step = 80 / this._queue.length;
            let feedbackStep = 20;

            this._editor.console.logSection("Quixel: Handle export");
            this._editor.updateTaskFeedback(task, feedbackStep, "Quixel: Handling exports...");
            await Promise.all(this._queue.map((q) => this._handleExport(q, atPosition).then(() => {
                this._editor.updateTaskFeedback(task, feedbackStep += step);
            })));
        }

        // Notify done
        this._editor.console.logInfo("Done!");

        this._editor.updateTaskFeedback(task, 100, "Done!");
        this._editor.closeTaskFeedback(task, 1000);

        // Refresh assets
        await this._editor.assetsBrowser.refresh();
        await this._editor.assets.refresh();

        // Register and notify
        this._queue.forEach((q) => {
            const exists = QuixelListener.ImportedAssets.find((a) => a.id === q.id);
            if (!exists) {
                QuixelListener.ImportedAssets.push(q);
            }

            this.onAssetImportedObservable.notifyObservers(q);
        });

        // Empty queue
        this._queue.splice(0, this._queue.length);
    }

    /**
     * Creates the needed asset's directories.
     */
    private async _createAssetsDirectories(json: IQuixelExport): Promise<void> {
        const rootFolder = `quixel/${json.type}`;

        await FSTools.CreateDirectory(join(this._editor.assetsBrowser.assetsDirectory, rootFolder));
        await FSTools.CreateDirectory(join(this._editor.assetsBrowser.assetsDirectory, rootFolder, basename(json.path)));
    }

    /**
     * Returns the root directory of the asset.
     */
    private _getRootDirectory(json: IQuixelExport): string {
        return join(this._editor.assetsBrowser.assetsDirectory, `quixel/${json.type}`, basename(json.path));
    }

    /**
     * Copies all the textures of the given quixel export.
     */
    private async _copyTextures(json: IQuixelExport): Promise<void> {
        if (!Project.DirPath || this._getExistingMaterial(json)) {
            return;
        }

        const rootFolder = this._getRootDirectory(json);

        const components = json.components.filter((c) => QuixelListener._SupportedTexturesTypes.indexOf(c.type) !== -1);
        const promises = components.map(async (c) => {
            // Get mode
            let simpleCopy = true;

            if (preferences.useOnlyAlbedoAsHigherQuality) {
                simpleCopy = false;

                if (c.type === "albedo" || c.type === "mask") {
                    simpleCopy = true;
                }

                if (c.type === "opacity" && preferences.mergeOpacityAlphaToAlbedo) {
                    simpleCopy = true;
                }
            }

            // Simply copy?
            if (simpleCopy) {
                const path = join(rootFolder, c.name);
                await copyFile(c.path, path);

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

                    const path = join(rootFolder, replacedName);
                    await writeFile(path, Buffer.from(await Tools.ReadFileAsArrayBuffer(resizedTextureBlob)));

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
    private async _handleExport(json: IQuixelExport, atPosition?: Vector3): Promise<void> {
        if (json.type === "brush") {
            return;
        }

        // A material exists in any cases
        const displacement = json.components.find((c) => c.type === "displacement");

        // Create materials
        const materials: PBRMaterial[] = [];
        if (json.materials.length) {
            for (const m of json.materials) {
                materials.push(await this._createMaterial(json, {
                    displacement,
                    textureSets: m.textureSets,
                }));
            }
        } else {
            materials.push(await this._createMaterial(json, {
                displacement,
            }));
        }

        switch (json.type) {
            case "3d":
                await this._handle3dExport(json, materials, displacement, atPosition);
                break;

            case "3dplant":
                await this._hande3dPlantExport(json, materials[0], displacement, atPosition);
                break;
        }
    }

    /**
     * Handles exports of type "3d" (3d assets).
     */
    private async _handle3dExport(json: IQuixelExport, materials: PBRMaterial[], displacement?: IQuixelComponent, atPosition?: Vector3): Promise<void> {
        const meshes = await this._createMeshes(json.id, json.lodList, displacement, atPosition);
        meshes.forEach((m) => {
            m.isPickable = (m._masterMesh ?? null) === null;

            if (m instanceof Mesh) {
                m.scaling.setAll(preferences.objectScale);
                m.material = materials[m.metadata.materialId] ?? materials[0];
            }
        });

        return this._writeAllMeshesToAssets(json, meshes);
    }

    /**
     * Handles exports of type "3dplant" (3d plants).
     */
    private async _hande3dPlantExport(json: IQuixelExport, material: PBRMaterial, displacement?: IQuixelComponent, atPosition?: Vector3): Promise<void> {
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

        const targetPosition = preferences.merge3dPlants ? undefined : atPosition;
        const promises = variations.map((v, _index) => this._createMeshes(json.id, v, displacement, targetPosition));
        const variationsMeshes = await Promise.all(promises);

        // Material
        let effectiveMaterial: Material = material;
        if (preferences.use3dPlantsNodeMaterial) {
            const nodeMaterial = NodeMaterial.Parse(plantMaterialJson, this._editor.scene!, undefined!);
            nodeMaterial.id = material.id;
            nodeMaterial.name = material.name;
            nodeMaterial.build(false);

            for (const block of nodeMaterial.getTextureBlocks()) {
                let texture: Nullable<BaseTexture> = null;

                switch (block.name) {
                    case "Albedo Texture": texture = material.albedoTexture; break;
                    case "Roughness Texture": texture = material.metallicTexture; break;
                    case "Bump Texture": texture = material.bumpTexture; break;
                    case "Translucency Texture": texture = material.subSurface.thicknessTexture; break;
                }

                if (!texture || !(texture instanceof Texture)) {
                    continue;
                }

                const serializationData = texture.serialize();
                // serializationData.name = basename(texture.name);
                serializationData.name = CopyTools.GenerateBase64StringFromTexture(texture);
                serializationData.url = basename(texture.name);

                block.texture = Texture.Parse(serializationData, this._editor.scene!, "") as Texture;

                effectiveMaterial = nodeMaterial;
            }

            // Add editor path
            const rootFolder = this._getRootDirectory(json);
            const materialJsonPath = join(rootFolder, `${nodeMaterial.name}.material`);

            nodeMaterial.metadata = material.metadata;

            await writeJSON(materialJsonPath, {
                ...nodeMaterial.serialize(),
                metadata: nodeMaterial.metadata,
            }, {
                spaces: "\t",
                encoding: "utf-8",
            });

            material.dispose(true, true);
        }

        // Merge?
        if (preferences.merge3dPlants) {
            this._editor.console.logInfo(`Merging 3d plants named "${json.name}"`);

            const meshesToMerge: Mesh[][] = [];
            variationsMeshes.forEach((variation) => {
                variation.forEach((m, meshIndex) => {
                    if (!meshesToMerge[meshIndex]) { meshesToMerge.push([]); }
                    meshesToMerge[meshIndex].push(m);
                });
            });

            const mergedMeshes: Mesh[] = [];
            meshesToMerge.forEach((mm, index) => {
                const mesh = Mesh.MergeMeshes(mm, true, true, undefined, false, false);
                if (!mesh) { return; }

                if (index === 0) {
                    mesh.position.copyFrom(atPosition ?? Vector3.Zero());
                    mesh.scaling.setAll(preferences.objectScale);

                    mesh.metadata = {
                        isFromQuixel: true,
                        lodDistance: preferences.lodDistance,
                        quixelMeshId: json.id,
                    };

                    this._editor.scene!.lights.forEach((l) => {
                        l.getShadowGenerator()?.getShadowMap()?.renderList?.push(mesh);
                    });
                } else {
                    mergedMeshes[0].addLODLevel(preferences.lodDistance * index, mesh);
                }

                mesh.id = Tools.RandomId();
                mesh.isPickable = false;
                mesh.receiveShadows = true;
                mesh.checkCollisions = false;
                mesh.material = effectiveMaterial;

                mergedMeshes.push(mesh);
            });

            this._editor.graph.refresh();

            await this._writeAllMeshesToAssets(json, mergedMeshes);
        } else {
            variationsMeshes.forEach((variationMeshes) => {
                variationMeshes.forEach((m) => {
                    m.material = effectiveMaterial;
                    m.isPickable = (m._masterMesh ?? null) === null;

                    if (m.hasLODLevels) {
                        m.scaling.setAll(preferences.objectScale);
                        m.rotation.set(-Math.PI * 0.5, 0, 0);
                    }
                });
            });

            await Promise.all(variationsMeshes.map(async (variationMeshes, variationIndex) => {
                await this._writeAllMeshesToAssets(json, variationMeshes, variationIndex);
            }));
        }
    }

    /**
     * Writes all the given meshes to the assets.
     */
    private async _writeAllMeshesToAssets(json: IQuixelExport, meshes: Mesh[], variationIndex?: number): Promise<void> {
        await Promise.all(meshes.map(async (r, index) => {
            const rootUrl = this._getRootDirectory(json);
            const name = (json.type === "3dplant" && variationIndex !== undefined) ? `${json.name}-var${variationIndex + 1}` : json.name;

            const filePath = join(rootUrl, `${name}-lod${index}.babylon`);
            const assetsPath = filePath.replace(join(this._editor.assetsBrowser.assetsDirectory, "/"), "");

            const metadata = Tools.GetMeshMetadata(r);
            if (metadata.originalSourceFile) {
                metadata.originalSourceFile.sceneFileName = assetsPath;
            }

            if (index > 0) {
                metadata.lodMeshPath = assetsPath;
            }

            const serializedMesh = MeshExporter.ExportMesh(r, false, false);
            serializedMesh.meshes?.forEach((m) => {
                m.scaling = [preferences.objectScale, preferences.objectScale, preferences.objectScale];
            });

            if (r.material) {
                const textures = r.material.getActiveTextures();
                const names = textures.map((t) => t.name);

                textures.forEach((t) => t.name = basename(t.name));

                serializedMesh.materials ??= [];
                serializedMesh.materials.push(r.material.serialize());

                textures.forEach((t, index) => t.name = names[index]);
            }

            await writeJSON(join(rootUrl, `${name}-lod${index}.babylon`), serializedMesh, {
                encoding: "utf-8",
            });
        }));
    }

    /**
     * Creates all the meshes including their LODs.
     */
    private async _createMeshes(id: string, lodList: IQuixelLOD[], displacement?: IQuixelComponent, atPosition?: Vector3): Promise<Mesh[]> {
        const parsedMeshes: IParsedMesh[] = [];
        const promises = lodList.map(async (lod, lodIndex) => {
            // Check existing
            const existingMeshes = this._getExistingMeshes(id);
            if (existingMeshes.length) {
                // TODO: create instances
            }

            const path = lod.path.replace(/\\/g, "/");
            const result = await SceneLoader.ImportMeshAsync("", join(dirname(path), "/"), basename(path), this._editor.scene!);

            result.meshes.forEach((m, index) => {
                let variation = parsedMeshes.find((pm) => pm.index === index);
                if (!variation) {
                    parsedMeshes.push(variation = { index: index, meshes: [] });
                }

                const metadata = Tools.GetMeshMetadata(m as Mesh);
                metadata.originalSourceFile = {
                    id: m.id,
                    name: m.name,
                    sceneFileName: "",
                };

                metadata.isFromQuixel = true;
                metadata.lodDistance = preferences.lodDistance;

                m.isPickable = false;
                m.receiveShadows = true;
                m.id = Tools.RandomId();
                m.checkCollisions = false;

                variation.meshes.push({
                    index: lodIndex,
                    mesh: m as Mesh,
                });

                console.log("Quixel Babylon.JS Editor Plugin: displacement ignored: ", displacement);

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
                m.mesh.metadata.quixelMeshLodName = lodList[pmIndex]?.lodObjectName ?? m.mesh.name;

                if (index === 0) {
                    m.mesh.position.copyFrom(atPosition ?? Vector3.Zero());
                    m.mesh.metadata.quixelMeshId = id;
                    m.mesh.metadata.materialId = pmIndex;

                    if (preferences.checkCollisions && !preferences.checkColiisionsOnLowerLod) {
                        m.mesh.checkCollisions = true;
                    }

                    return this._editor.scene!.lights.forEach((l) => {
                        l.getShadowGenerator()?.getShadowMap()?.renderList?.push(m.mesh);
                    });
                }

                parsedMeshes[pmIndex].meshes[0].mesh.addLODLevel(preferences.lodDistance * index, m.mesh);

                if (preferences.checkCollisions && preferences.checkColiisionsOnLowerLod && index === parsedMeshes.length - 1) {
                    m.mesh.metadata ??= {};
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
     * Returns the reference to the material in case it has been already imported in the scene.
     */
    private _getExistingMaterial(json: IQuixelExport, textureSets?: string[]): Nullable<PBRMaterial> {
        const id = `${json.id}-${(textureSets ?? []).join("-")}`;

        const material = this._editor.scene!.materials.find((m) => m.metadata?.quixelMaterialId === id);
        if (material && material instanceof PBRMaterial) {
            return material;
        }

        return null;
    }

    /**
     * Returns the list of all existing meshes with the given id.
     */
    private _getExistingMeshes(id: string): Mesh[] {
        return this._editor.scene!.meshes.filter((m) => m instanceof Mesh && m.metadata?.quixelMeshId === id) as Mesh[];
    }

    /**
     * Creates the material acording to the given json configuration.
     */
    private async _createMaterial(json: IQuixelExport, options: IMaterialOptions): Promise<PBRMaterial> {
        const existingMaterial = this._getExistingMaterial(json, options.textureSets);
        if (existingMaterial) {
            return existingMaterial;
        }

        const rootFolder = this._getRootDirectory(json);

        let name = json.name;
        if (options.textureSets?.length) {
            name += `-${options.textureSets.join("-")}`;
        }

        const material = new PBRMaterial(name, this._editor.scene!);
        material.id = Tools.RandomId();
        material.invertNormalMapX = true;
        material.invertNormalMapY = true;

        if (!Project.DirPath) {
            return material;
        }

        let albedoTexture: Nullable<Texture> = null;
        let opacityTexture: Nullable<Texture> = null;

        let reflectivityTexture: Nullable<Texture> = null;
        let microSurfaceTexture: Nullable<Texture> = null;

        let metallicTexture: Nullable<Texture> = null;
        let roughnessTexture: Nullable<Texture> = null;

        let bumpTexture: Nullable<Texture> = null;
        let displacementTexture: Nullable<Texture> = null;

        let aoTexture: Nullable<Texture> = null;

        let maskTexture: Nullable<Texture> = null;

        let components = json.components.filter((c) => QuixelListener._SupportedTexturesTypes.indexOf(c.type) !== -1);
        if (options.textureSets) {
            components = components.filter((c) => c.textureSets?.find((ts) => options.textureSets?.indexOf(ts) !== -1));
        }

        const metallicRoughnessComponent = components.find((c) => c.type === "metalness" || c.type === "roughness");

        const promises = components.map(async (c) => {
            const path = join(rootFolder, c.name);
            let texture: Texture;

            try {
                texture = await new Promise<Texture>((resolve, reject) => {
                    const texture = new Texture(path, this._editor.scene!, false, true, undefined, () => {
                        texture.name = path.replace(join(this._editor.assetsBrowser.assetsDirectory, "/"), "");
                        texture.url = texture.name;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                    });
                });
            } catch (e) {
                return;
            }

            switch (c.type) {
                case "albedo": albedoTexture = texture; break;
                case "opacity": opacityTexture = texture; break;
                case "mask": maskTexture = texture; break;

                case "normal": bumpTexture = texture; break;
                case "displacement": displacementTexture = texture; break;

                case "specular":
                    if (!metallicRoughnessComponent) {
                        reflectivityTexture = texture;
                    }
                    break;

                case "gloss":
                    if (!metallicRoughnessComponent) {
                        microSurfaceTexture = texture;
                    }
                    break;

                case "metalness": metallicTexture = texture; break;
                case "roughness": roughnessTexture = texture; break;
                case "ao": aoTexture = texture; break;

                case "translucency":
                    material.subSurface.isTranslucencyEnabled = true;
                    material.subSurface.thicknessTexture = texture;
                    material.subSurface.useMaskFromThicknessTexture = true;
                    break;
            }
        });

        await Promise.all(promises);

        // Pack textures
        await Promise.all([
            AlbedoOpacityPacker.Pack(this._editor, material, albedoTexture, opacityTexture, rootFolder),
            ReflectivityGlossinessPacker.Pack(this._editor, material, reflectivityTexture, microSurfaceTexture, rootFolder),
            MetallicRoughnessPacker.Pack(this._editor, material, metallicTexture, roughnessTexture, rootFolder),
            NormalDisplacementPacker.Pack(this._editor, material, bumpTexture, displacementTexture, rootFolder),
        ]);

        // Pack ao with metal
        await MetallicAmbientPacker.Pack(this._editor, material, material.metallicTexture as Texture, aoTexture, rootFolder);

        // Pack mask texture
        await MaskPacker.Pack(this._editor, material, maskTexture, rootFolder);

        // Add metadata
        material.metadata = {};
        material.metadata.quixelMaterialId = `${json.id}-${(options.textureSets ?? []).join("-")}`;

        // Add editor path
        const materialJsonPath = join(rootFolder, `${material.name}.material`);
        material.metadata.editorPath = materialJsonPath.replace(join(this._editor.assetsBrowser.assetsDirectory, "/"), "");

        if (json.type === "surface") {
            material.metadata.isFromQuixel = true;
            material.metadata.quixelDisplacement = options.displacement;
        }

        // 3d plants
        if (json.type === "3dplant") {
            material.useSpecularOverAlpha = false;
        }

        await writeJSON(materialJsonPath, {
            ...material.serialize(),
            metadata: material.metadata,
        }, {
            spaces: "\t",
            encoding: "utf-8",
        });

        return material;
    }
}
