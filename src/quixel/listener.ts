import { readFile } from "fs-extra";
import { basename } from "path";

import {
    Nullable,
    Geometry, Tools as BabylonTools, Vector3,
    VertexData, Mesh, PBRMaterial, Space, Texture,
} from "babylonjs";
import { Editor } from "babylonjs-editor";

import { QuixelServer } from "./server";
import { IQuixelExport, IQuixelLOD } from "./types";

import { FBXLoader } from "../fbx/loader";
import { preferences } from "./preferences";

export class QuixelListener {
    /**
     * Inits the quixel listener.
     * @param editor the editor reference.
     */
    public static Init(editor: Editor): void {
        new QuixelListener(editor);
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
    private async _handle3dExport(json: IQuixelExport): Promise<void> {
        const meshes: Mesh[] = [];

        // Fbx
        for (const lod of json.lodList) {
            const lodContent = await readFile(lod.path);

            // Check if the FBX file is 
            if (!FBXLoader.IsValidFBX(lodContent)) {
                this._editor.console.logWarning(`Can't parse FBX file "${lod.path}" as it is not valid.`);
                continue;
            }
            
            const mesh = this._parseMesh(lod,  lodContent);
            if (!mesh) { return; }

            // Create material
            if (!meshes.length) {
                mesh.name = json.name;
                mesh.scaling.scale(preferences.objectScale);

                // Add to shadows
                this._editor.scene!.lights.forEach((l) => {
                    l.getShadowGenerator()?.getShadowMap()?.renderList?.push(mesh);
                });

                mesh.material = await this._parseMaterial(json);
            }

            meshes.push(mesh);
        }

        // LODs
        meshes.forEach((m, index) => {
            if (index < 1) { return }

            meshes[0].addLODLevel(20 * index, m);
            m.material = meshes[0].material;
        });

        // Refresh
        this._editor.graph.refresh();
        return this._editor.assets.refresh();
    }

    /**
     * Handles the given quixel export json as a surface asset.
     */
    private async _handleSurfaceExport(json: IQuixelExport): Promise<void> {
        await this._parseMaterial(json);
        return this._editor.assets.refresh();
    }

    /**
     * Handles the given quixel export json as a 3d asset.
     */
    private async _handle3dPlantExport(json: IQuixelExport): Promise<void> {
        // TODO: manage plants.
        this._handle3dExport(json);
    }

    /**
     * Parses the mesh using the given content.
     */
    private _parseMesh(lod: IQuixelLOD, lodContent: Buffer): Nullable<Mesh> {
        const loader = new FBXLoader(lodContent);
        const geometryData = loader.parse();
        if (!geometryData) { return null; }

        const mesh = new Mesh(lod.lodObjectName, this._editor.scene!);
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

        const geometry = new Geometry(BabylonTools.RandomId(), this._editor.scene!, vertexData, false);
        geometry.applyToMesh(mesh);

        return mesh;
    }

    /**
     * Parses the material using the given description.
     */
    private async _parseMaterial(json: IQuixelExport): Promise<Nullable<PBRMaterial>> {
        const material = new PBRMaterial(json.name, this._editor.scene!);
        material.id = BabylonTools.RandomId();
        material.ambientColor.copyFrom(preferences.ambientColor);
        material.metadata = {
            isFromQuixel: true,
        };

        // Copy textures
        await this._editor.assets.addFilesToAssets(json.components.map((c) => ({
            name: c.name,
            path: c.path,
        })));

        // Apply textures
        json.components.forEach((c) => {
            switch (c.type) {
                case "albedo": material.albedoTexture = this._getTexture(c.name); break;
                case "normal": material.bumpTexture = this._getTexture(c.name); break;
                case "specular": material.reflectivityTexture = this._getTexture(c.name); break;
                case "gloss": material.microSurfaceTexture = this._getTexture(c.name); break;
                case "roughness":
                    material.metallicTexture = this._getTexture(c.name);
                    material.useRoughnessFromMetallicTextureGreen = true;
                    material.metallic = 0;
                    material.roughness = 1;
                    break;
                case "cavity":
                case "ao":
                    material.ambientTexture = this._getTexture(c.name);
                    break;
                case "opacity":
                    material.opacityTexture = this._getTexture(c.name);
                    if (material.opacityTexture) {
                        material.opacityTexture.getAlphaFromRGB = true;
                    }
                    break;
                case "transmission":
                    material.subSurface.isTranslucencyEnabled = true;
                    material.subSurface.thicknessTexture = this._getTexture(c.name);
                    material.subSurface.translucencyIntensity = 1;
                    break;
                default: break;
            }
        });

        return material;
    }

    /**
     * Gets the texture identified by the given name.
     */
    private _getTexture(name: string): Texture {
        const texture = this._editor.scene!.textures.find((t) => basename(t.name) === name);
        return texture instanceof Texture ? texture : null!;
    }
}
