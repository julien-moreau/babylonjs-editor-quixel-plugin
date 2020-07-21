import { IStringDictionary, Nullable } from "babylonjs-editor/shared/types";

import { IFBXGeometry, IFBXNode } from "./types";

export interface IFBXParsedData {
    dataSize: number;
    buffer: number[];
    indices: number[];
    mappingType: string;
    referenceType: string;
}

export interface IFBXBuffers {
    vertex: number[],
    index: number[],
    normal: number[],
    uvs: number[],
}

export interface IFBXGeometryInformations {
    vertexPositions: number[];
    vertexIndices: number[];
    normal: Nullable<IFBXParsedData>;
    uv: Nullable<IFBXParsedData>;
}

export class FBXGeometry {
    /**
     * Parses the given Geometry node.
     * @param geoNode defines the "Geometry" object from the FBX file.
     */
    public parse(geoNode: IStringDictionary<IFBXNode>): IFBXGeometry {
        const geo: IFBXGeometryInformations = {
            vertexPositions: geoNode.Vertices?.a ?? [],
            vertexIndices: geoNode.PolygonVertexIndex?.a ?? [],
            normal: this._parseNormals(geoNode.LayerElementNormal),
            uv: this._parseUVs(geoNode.LayerElementUV),
        };

        const buffers = this._genBuffers(geo);

        return {
            positions: buffers.vertex,
            indices: buffers.index,
            normals: buffers.normal,
            uvs: buffers.uvs,
        };
    }

    /**
     * Generates the buffers according to the 
     */
    private _genBuffers(geoInfo: IFBXGeometryInformations): IFBXBuffers {
        const buffers: IFBXBuffers = {
            vertex: [],
            index: [],
            normal: [],
            uvs: [],
        };

        let polygonIndex = 0;
        let faceLength = 0;

        // these will hold data for a single face
        let facePositionIndexes: number[] = [];
        let faceNormals: number[] = [];
        let faceUVs: number[] = [];

        geoInfo.vertexIndices.forEach((vertexIndex, polygonVertexIndex) => {

            let endOfFace = false;

            // Face index and vertex index arrays are combined in a single array
            // A cube with quad faces looks like this:
            // PolygonVertexIndex: *24 {
            //  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
            //  }
            // Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
            // to find index of last vertex bit shift the index: ^ - 1
            if (vertexIndex < 0) {
                vertexIndex = vertexIndex ^ - 1; // equivalent to ( x * -1 ) - 1
                endOfFace = true;
            }

            facePositionIndexes.push(vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2);

            if (geoInfo.normal) {
                const data = this._getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal);
                faceNormals.push(data[0], data[1], data[2]);
            }

            if (geoInfo.uv) {
                const data = this._getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.uv);

                faceUVs.push(data[0]);
                faceUVs.push(data[1]);
            }

            faceLength++;
            
            if (endOfFace) {
                this._genFace(buffers, geoInfo, facePositionIndexes, faceNormals, faceUVs, faceLength);
                
                polygonIndex++;
                faceLength = 0;

                // reset arrays for the next face
                facePositionIndexes = [];
                faceNormals = [];
                faceUVs = [];
            }
        });

        return buffers;
    }

    /**
     * Generates the face and populates the "buffers" object.
     */
    private _genFace(buffers: IFBXBuffers, geoInfo: IFBXGeometryInformations, facePositionIndexes: number[], faceNormals: number[], faceUVs: number[], faceLength: number): void {
        for (var i = 2; i < faceLength; i++) {
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[0]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[1]]);

            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3 + 2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3 + 1]]);

            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i * 3]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i * 3 + 2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i * 3 + 1]]);

            buffers.index.push(buffers.index.length);
            buffers.index.push(buffers.index.length);
            buffers.index.push(buffers.index.length);

            if (geoInfo.normal) {
                buffers.normal.push(faceNormals[0]);
                buffers.normal.push(faceNormals[2]);
                buffers.normal.push(faceNormals[1]);

                buffers.normal.push(faceNormals[(i - 1) * 3]);
                buffers.normal.push(faceNormals[(i - 1) * 3 + 2]);
                buffers.normal.push(faceNormals[(i - 1) * 3 + 1]);

                buffers.normal.push(faceNormals[i * 3]);
                buffers.normal.push(faceNormals[i * 3 + 2]);
                buffers.normal.push(faceNormals[i * 3 + 1]);
            }

            if (geoInfo.uv) {
                buffers.uvs.push(faceUVs[0]);
                buffers.uvs.push(faceUVs[1]);

                buffers.uvs.push(faceUVs[(i - 1) * 2]);
                buffers.uvs.push(faceUVs[(i - 1) * 2 + 1]);

                buffers.uvs.push(faceUVs[i * 2]);
                buffers.uvs.push(faceUVs[i * 2 + 1]);
            }
        }
    }

    /**
     * Parses the normals of the given normals node.
     */
    private _parseNormals(normalNode: any): Nullable<IFBXParsedData> {
        if (!normalNode) { return null; }

        const mappingType = normalNode.MappingInformationType;
        const referenceType = normalNode.ReferenceInformationType;
        const buffer = normalNode.Normals.a;

        let indexBuffer = [];

        if (referenceType === "IndexToDirect") {
            if ("NormalIndex" in normalNode) {
                indexBuffer = normalNode.NormalIndex.a;
            } else if ("NormalsIndex" in normalNode) {
                indexBuffer = normalNode.NormalsIndex.a;
            }
        }

        return {
            dataSize: 3,
            buffer: buffer,
            indices: indexBuffer,
            mappingType: mappingType,
            referenceType: referenceType
        };
    }

    /**
     * Parses the UVs of the given uvs node.
     */
    private _parseUVs(uvNode: any): Nullable<IFBXParsedData> {
        if (!uvNode) { return null; }

        var mappingType = uvNode.MappingInformationType;
        const referenceType = uvNode.ReferenceInformationType;
        const buffer = uvNode.UV.a;
        let indexBuffer = [];
        if (referenceType === "IndexToDirect") {
            indexBuffer = uvNode.UVIndex.a;
        }

        return {
            dataSize: 2,
            buffer: buffer,
            indices: indexBuffer,
            mappingType: mappingType,
            referenceType: referenceType
        };
    }

    /**
     * Returns the data of the given polygon informations.
     */
    private _getData(polygonVertexIndex: number, polygonIndex: number, vertexIndex: number, infoObject: IFBXParsedData): number[] {
        let index: number = polygonVertexIndex;

        switch (infoObject.mappingType) {
            case 'ByPolygon': index = polygonIndex; break;
            case 'ByVertice': index = vertexIndex; break;
            case 'AllSame': index = infoObject.indices[0]; break;
            default: break;
        }

        if (infoObject.referenceType === 'IndexToDirect') {
            index = infoObject.indices[index];
        }

        var from = index * infoObject.dataSize;
        var to = from + infoObject.dataSize;

        return this._slice(infoObject.buffer, from, to);
    }

    /**
     * Slices the given array.
     */
    private _slice(b: number[], from: number, to: number): number[] {
        const a: number[] = [];
        for (var i = from, j = 0; i < to; i++, j++) {
            a[j] = b[i];
        }

        return a;
    }
}
