export interface IFBXNode {
    id?: string;
    name?: string;
    singleProperty?: boolean;
    propertyList?: any[];
    attrName?: string;
    attrType?: string;
    connections?: any[];
    a?: any;
}

export interface IFBXGeometry {
    positions: number[];
    indices?: number[];

    normals?: number[];
    uvs?: number[];
}
