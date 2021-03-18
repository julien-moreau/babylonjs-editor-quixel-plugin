import { basename, join, dirname } from "path";
import { readFile, writeJSON, remove, copy, readJSON } from "fs-extra";

import {
    Nullable,
    Geometry, Tools as BabylonTools, Vector3, Quaternion,
    VertexData, Mesh, PBRMaterial, Space, Texture,
    NullEngine, Scene, SceneSerializer, Material,
} from "babylonjs";
import { Editor, MeshesAssets, Project, FilesStore, MaterialAssets, Tools, TextureAssets } from "babylonjs-editor";
import { INumberDictionary } from "babylonjs-editor/shared/types";

import { QuixelServer } from "./server";
import { IQuixelComponent, IQuixelExport, IQuixelLOD } from "./types";

import { FBXLoader } from "../fbx/loader";
import { preferences } from "./preferences";

import { TextureMergeTools } from "../tools/mergeTexture";

export class QuixelListener {
    private static _Instance: Nullable<QuixelListener> = null;

    /**
     * Inits the quixel listener.
     * @param editor the editor reference.
     */
    public static Init(editor: Editor): void {
        this._Instance = this._Instance ?? new QuixelListener(editor);
    }

    private _computing: boolean = false;
    private _queue: IQuixelExport[] = [];

    /**
     * Constructor.
     * @param _editor defines the editor reference.
     */
    public constructor(private _editor: Editor) {
        // Register to the event
        QuixelServer.OnExportedAssetObservable.add(async (exports) => {
            exports.forEach((e) => this._queue.push(e));
            this._handleAll();
        });
    }

    /**
     * Handles all exports in the current queue.
     */
    private async _handleAll(): Promise<void> {
        if (this._computing) { return; }
        this._computing = true;

        while (this._queue.length) {
            const json = this._queue.shift()!;

            switch (json.type) {
                case "3d": await this._handle3dExport(json); break;
                case "3dplant": await this._handle3dPlantExport(json); break;
                
                case "surface":
                case "atlas":
                    await this._handleSurfaceExport(json);
                    break;
                
                default: break;
            }
        }

        this._computing = false;
    }

    /**
     * Handles the given quixel export json as a 3d asset.
     */
    private async _handle3dExport(json: IQuixelExport, material?: Nullable<Material>): Promise<void> {
        const meshes: Mesh[] = [];

        const engine = preferences.automaticallyAddToScene ? null : new NullEngine();
        const scene = preferences.automaticallyAddToScene ? this._editor.scene! : new Scene(engine!);

        const task = this._editor.addTaskFeedback(0, `Processing "${json.name}"`);
        const step = 100 / json.lodList.length;
        let currentStep = 0;

        // Fbx
        for (const lod of json.lodList) {
            this._editor.console.logInfo(`Parsing FBX mesh from Quixel Bridge at path: "${lod.path}"`);
            const lodContent = await readFile(lod.path);

            // Check if the FBX file is 
            if (!FBXLoader.IsValidFBX(lodContent)) {
                this._editor.console.logWarning(`Can't parse FBX file "${lod.path}" as it is not valid.`);
                continue;
            }
            
            const mesh = this._parseMesh(lod, lodContent, scene);
            if (!mesh) { return; }

            // Create material
            if (!meshes.length) {
                mesh.name = json.name;
                mesh.scaling.scale(preferences.objectScale);
                mesh.metadata = {
                    isFromQuixel: true,
                    lodDistance: preferences.lodDistance,
                };

                // Add to shadows?
                if (preferences.automaticallyAddToScene) {
                    this._editor.scene!.lights.forEach((l) => {
                        l.getShadowGenerator()?.getShadowMap()?.renderList?.push(mesh);
                    });
                }

                mesh.material = material ?? await this._parseMaterial(json, scene);
            }

            meshes.push(mesh);

            // Task feedback.
            currentStep += step;
            this._editor.updateTaskFeedback(task, currentStep);
        }

        // LODs
        meshes.forEach((m, index) => {
            if (index < 1) { return }

            meshes[0].addLODLevel(preferences.lodDistance * index, m);
            m.material = meshes[0].material;
        });

        // Add to assets?
        if (!preferences.automaticallyAddToScene) {
            this._editor.updateTaskFeedback(task, 0, `Adding "${json.name}" to assets...`)
            meshes[0].material?.getActiveTextures().forEach((texture) => {
                texture.name = basename(texture.name);
                if (texture["url"]) { texture["url"] = texture.name; }
            });

            const sceneJson = SceneSerializer.Serialize(scene);
            sceneJson.meshes.forEach((m) => {
                if (!m) { return; }

                const mesh = scene.getMeshByID(m.id);
                if (!mesh || !(mesh instanceof Mesh)) { return; }

                const lods = mesh.getLODLevels();
                if (!lods.length) { return; }

                m.lodMeshIds = lods.map((lod) => lod.mesh?.id);
                m.lodDistances = lods.map((lod) => lod.distance);
                m.lodCoverages = lods.map((lod) => lod.distance);
            });

            const tempSceneName = `${json.lodList[0].lodObjectName}.babylon`;
            const tempScenePath = join(dirname(json.path), tempSceneName);

            try {
                this._editor.updateTaskFeedback(task, 50);

                await writeJSON(tempScenePath, sceneJson);

                this._editor.assets.selectTab(MeshesAssets);

                await this._editor.assets.addFilesToAssets([{
                    name: tempSceneName,
                    path: tempScenePath,
                }]);

                this._editor.updateTaskFeedback(task, 75);
            } catch (e) {
                // Catch silently.
            }

            try {
                await remove(tempScenePath);
            } catch (e) {
                // Catch silently
            }

            scene.dispose();
            engine!.dispose();
        }

        // Collisions
        meshes.forEach((m) => m.checkCollisions = false);
        
        if (preferences.checkCollisions) {
            if (preferences.checkColiisionsOnLowerLod) {
                const lastMesh = meshes[meshes.length - 1];
                lastMesh.metadata = lastMesh.metadata ?? { };
                lastMesh.metadata.keepGeometryInline = true;

                const collisionInstance = lastMesh?.createInstance("collisionsInstance");
                collisionInstance.checkCollisions = true;
                collisionInstance.parent = meshes[0];
                collisionInstance.isVisible = false;
                collisionInstance.id = BabylonTools.RandomId();
                collisionInstance.rotationQuaternion = Quaternion.Identity();
            } else {
                meshes[0].checkCollisions = true;
            }
        }

        // Feedback
        this._editor.updateTaskFeedback(task, 100, "Done!");
        this._editor.closeTaskFeedback(task, 1000);

        // Refresh
        this._editor.graph.refresh();
        return this._editor.assets.refresh(MaterialAssets, meshes[0].material);
    }

    /**
     * Handles the given quixel export json as a surface asset.
     */
    private async _handleSurfaceExport(json: IQuixelExport): Promise<void> {
        const material = await this._parseMaterial(json, this._editor.scene!);
        if (material) {
            return this._editor.assets.refresh(MaterialAssets, material);
        }
    }

    /**
     * Handles the given quixel export json as a 3d asset.
     */
    private async _handle3dPlantExport(json: IQuixelExport): Promise<void> {
        const clone = Tools.CloneObject(json);

        // Create material
        const material = await this._parseMaterial(json, this._editor.scene!);
        
        // Order by variation
        const variations: INumberDictionary<IQuixelLOD[]> = { };
        json.lodList.forEach((lod) => {
            if (!lod.variation) { return; }

            if (!variations[lod.variation]) {
                variations[lod.variation] = [];
            }

            variations[lod.variation].push(lod);
        });

        for (const v in variations) {
            await this._handle3dExport(
                {
                    ...clone,
                    lodList: variations[v],
                },
                material,
            );
        }
    }

    /**
     * Parses the mesh using the given content.
     */
    private _parseMesh(lod: IQuixelLOD, lodContent: Buffer, scene: Scene): Nullable<Mesh> {
        const loader = new FBXLoader(lodContent);
        const geometryData = loader.parse();
        if (!geometryData) { return null; }

        const mesh = new Mesh(lod.lodObjectName, scene);
        mesh.id = BabylonTools.RandomId();
        mesh.scaling.set(preferences.objectScale, preferences.objectScale, preferences.objectScale);
        mesh.receiveShadows = true;
        mesh.rotate(new Vector3(1, 0, 0), -Math.PI * 0.5, Space.LOCAL);
        mesh.isPickable = false;

        const vertexData = new VertexData();
        vertexData.positions = geometryData.positions;
        vertexData.indices = geometryData.indices ?? null;
        vertexData.normals = geometryData.normals ?? [];
        vertexData.uvs = geometryData.uvs ?? [];

        const geometry = new Geometry(BabylonTools.RandomId(), scene, vertexData, false);
        geometry.applyToMesh(mesh);

        return mesh;
    }

    /**
     * Parses the material using the given description.
     */
    private async _parseMaterial(json: IQuixelExport, scene: Scene): Promise<Nullable<PBRMaterial>> {
        this._editor.console.logInfo(`Parsing material named "${json.name}"`);

        const existingMaterials = scene.materials.filter((m) => m.name === json.name).length;
        const count = existingMaterials ? ` ${existingMaterials}` : "";

        const material = new PBRMaterial(json.name + count, scene);
        material.id = BabylonTools.RandomId();
        material.ambientColor.copyFrom(preferences.ambientColor);
        material.metadata = {
            isFromQuixel: true,
        };

        const components: IQuixelComponent[] = [];

        // Copy textures
        if (preferences.automaticallyAddToScene) {
            this._editor.console.logInfo(`Adding material's textures to assets...`);

            if (preferences.useOnlyAlbedoAsHigherQuality) {
                const jsonConfigPath = join(json.path, `${json.id}.json`);
                const jsonConfig = await readJSON(jsonConfigPath, { encoding: "utf-8" });

                json.components.forEach((c) => {
                    if (json.type === "surface") {
                        const component = jsonConfig.maps.find((c2) => c2.type === c.type && c2.mimeType === "image/jpeg" && c2.resolution === "1024x1024");
                        if (!component) { return components.push(c); }

                        components.push({ name: component.uri, type: c.type, path: join(json.path, "Thumbs", "1k", component.uri) });
                    } else if (json.type === "3dplant") {
                        const component = jsonConfig.maps.find((c2) => c2.type === c.type && c2.mimeType === "image/jpeg" && c2.resolution === "1024x1024");
                        if (!component) { return components.push(c); }

                        const uri = basename(component.uri);
                        components.push({ name: uri, type: c.type, path: join(json.path, "Thumbs", "1k", uri) });
                    } else {
                        const component = jsonConfig.components.find((c2) => c2.type === c.type);
                        if (!component) { return components.push(c); }

                        const uris = component.uris[0];

                        const formats = uris.resolutions.find((u) => u.resolution === "1024x1024")?.formats;
                        if (!formats) { return components.push(c); }

                        const textureUri = formats.find((f) => f.mimeType === "image/jpeg")?.uri;
                        if (!textureUri) { return components.push(c); }

                        components.push({ name: textureUri, type: c.type, path: join(json.path, "Thumbs", "1k", textureUri) });
                    }
                });
                components[0] = json.components.find((c) => c.type === "albedo") ?? components[0];
            } else {
                json.components.forEach((c) => components.push(c));
            }

            await this._editor.assets.addFilesToAssets(components.map((c) => ({
                name: c.name,
                path: c.path,
            })));
        } else {
            json.components.forEach((c) => components.push(c));
            
            for (const c of json.components) {
                const texturePath = join(Project.DirPath!, "files", c.name);
                await copy(c.path, texturePath);
                FilesStore.List[texturePath] = { path: texturePath, name: c.name };
            }
        }

        // Apply textures
        let displacementTexture: Nullable<Texture> = null;

        components.forEach((c) => {
            let texture: Nullable<Texture> = null;

            if (preferences.automaticallyAddToScene) {
                texture = this._getTexture(c.name);
            } else {
                texture = new Texture(c.path, scene);
            }

            if (!texture) { return; }

            switch (c.type) {
                case "albedo": material.albedoTexture = texture; break;
                case "normal": material.bumpTexture = texture; break;
                case "specular": material.reflectivityTexture = texture; break;
                case "displacement": displacementTexture = texture; break;
                case "gloss": material.microSurfaceTexture = texture; break;
                case "ao": material.ambientTexture = texture; break;

                case "metalness":
                    material.metallicTexture = texture;
                    material.metallic = 1;
                    break;

                case "roughness":
                    material.sheen.isEnabled = true;
                    material.sheen.textureRoughness = texture;
                    break;
                

                case "opacity":
                    material.opacityTexture = texture;
                    if (material.opacityTexture) {
                        material.opacityTexture.getAlphaFromRGB = true;
                    }
                    break;
                default: break;
            }
        });

        if (material.bumpTexture) {
            if (displacementTexture) {
                const textureName = await TextureMergeTools.MergeDisplacementWithNormal(this._editor, displacementTexture, material.bumpTexture);
                const texture = textureName ? this._editor.assets.getComponent(TextureAssets)?.getLastTextureByName(textureName) : null;

                if (texture) {
                    material.bumpTexture = texture;
                    material.useParallax = true;
                    material.useParallaxOcclusion = true;
                }
            }

            material.invertNormalMapX = true;
            material.invertNormalMapY = true;
        }

        return material;
    }

    /**
     * Gets the texture identified by the given name.
     */
    private _getTexture(name: string): Nullable<Texture> {
        const texture = this._editor.scene!.textures.find((t) => basename(t.name) === name);
        return texture instanceof Texture ? texture : null;
    }
}
