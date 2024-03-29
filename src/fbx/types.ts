import { Nullable } from "babylonjs-editor/shared/types";

export interface IFBXNode {
    id?: string;
    name?: string;
    singleProperty?: boolean;
    propertyList?: any[];
    attrName?: string;
    attrType?: string;
    connections?: IFBXConnections;
    a?: any;
}

export interface IFBXBone {
    id: number;
    name: string;
    indices: number[];
    weights: number[];
    transformLink: number[];
}

export interface IFBXGeometry {
    positions: number[];
    indices?: number[];

    normals?: number[];
    uvs?: number[];
    colors?: Nullable<number[]>;

    bones?: Nullable<IFBXBone[]>;
    weights?: Nullable<number[]>;
    weightsIndices?: Nullable<number[]>;
}

export interface IFBXDeformer {

}

export type IFBXConnections = number[][];