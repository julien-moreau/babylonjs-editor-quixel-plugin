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

    /**
     * Defines the list of all texture sets for the component.
     */
    textureSets?: string[];
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

export interface IQuixelMaterial {
    opacityType: string;
    materialName: string;
    materialId: number;
    textureSets: string[];
}

export interface IQuixelMeta {
    /**
     * Defines the key of the meta data.
     */
    key: string;
    /**
     * Defines the displayable name of the metadata.
     */
    name: string;
    /**
     * Defines the value of the metadata.
     */
    value: string;
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
    meshList: IQuixelLOD[];
    /**
     * Defines the list of all available FBX files.
     */
    lodList: IQuixelLOD[];
    /**
     * Defines the list of all components of the asset (textures, etc.).
     */
    components: IQuixelComponent[];
    /**
     * Defines the list of all materials available for the mesh.
     * If materials.length equals 0, only single material.
     */
    materials: IQuixelMaterial[];

    /**
     * Defines the categories of the export.
     */
    categories: string[];

    /**
     * Defines the path to the preview image.
     */
    previewImage: string;
    /**
     * Defines the list of all meta data available for the asset.
     */
    meta: IQuixelMeta[];
}
