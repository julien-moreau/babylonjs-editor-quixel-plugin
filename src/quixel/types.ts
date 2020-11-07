export interface IQuixelComponent {
    /**
     * Defines the type of the component.
     */
    type: string;
    /**
     * Defines the name of the component. Typically the name of the texture.
     */
    name: string;
    /**
     * Defines the absolute path of the component's file.
     */
    path: string;
}

export interface IQuixelLOD {
    /**
     * Defines the name of the Lod.
     * @example "lod0"
     * @example "lod3"
     */
    lod: string;
    /**
     * Defines the absolute path of the FBX file.
     */
    path: string;
    /**
     * Defines the of the LOD object.
     */
    lodObjectName: string;
    /**
     * Defines the variation id of the lod.
     */
    variation?: number;
}

export interface IQuixelMesh {
    /**
     * Defines the name of the mesh files.
     */
    name: string;
}

export interface IQuixelExport {
    /**
     * Defines the name of the exported asset.
     */
    name: string;
    /**
     * Defines the path of the folder containing ALL the asset's files.
     */
    path: string;
    /**
     * Defines the id of the model.
     */
    id: string;
    /**
     * Defines the type of asset.
     */
    type: "3d" | "surface" | "atlas" | "3dplant";
    /**
     * Defines the list of all meshes available.
     */
    meshList: IQuixelMesh[];
    /**
     * Defines the list of all available FBX files.
     */
    lodList: IQuixelLOD[];
    /**
     * Defines the list of all components of the asset (textures, etc.).
     */
    components: IQuixelComponent[];
}
