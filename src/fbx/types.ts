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

export interface IFBXGeometry {
    positions: number[];
    indices?: number[];

    normals?: number[];
    uvs?: number[];
}

export type IFBXConnections = number[][];