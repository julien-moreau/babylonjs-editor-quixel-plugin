import { IStringDictionary, Nullable } from "babylonjs-editor/shared/types";

import { IFBXGeometry, IFBXNode, IFBXConnections } from "./types";

export interface IFBXParsedData {
    dataSize: number;
    buffer: number[];
    indices: number[];
    mappingType: string;
    referenceType: string;
}

export interface IFBXBuffers {
    vertex: number[];
    index: number[];
    normal: number[];
    uvs: number[];
    colors: number[];
}

export interface IFBXGeometryInformations {
    vertexPositions: number[];
    vertexIndices: number[];
    normal: Nullable<IFBXParsedData>;
    uv: Nullable<IFBXParsedData>;
    colors: Nullable<IFBXParsedData>;
}

export interface IParseOptions {
    geometry: IStringDictionary<IFBXNode>;
    connections: IFBXConnections;
}

export class FBXGeometry {
    /**
     * Parses the given Geometry node.
     * @param options defines the parsing options containing the need geometry, skinnin, connections etc. informations.
     */
    public parse(options: IParseOptions): IFBXGeometry[] {
        return this._recursivelyParse(options.geometry, [], options);
    }

    /**
     * Recursively parses the geometries taking according to the given root geometry.
     */
    private _recursivelyParse(rootGeometryNode: IStringDictionary<IFBXNode>, geometries: IFBXGeometry[], options: IParseOptions): IFBXGeometry[] {
        geometries.push(this._genGeomeetry(rootGeometryNode));

        options.connections.forEach((c) => {
            const id = c[0].toString();
            const value = rootGeometryNode[id] as IStringDictionary<IFBXNode>;

            if (value?.name === "Geometry") {
                this._recursivelyParse(value, geometries, options);
            }
        });

        return geometries;
    }

    /**
     * Returns the geometry data according to the given geometry node.
     */
    private _genGeomeetry(geoNode: IStringDictionary<IFBXNode>): IFBXGeometry {
        const geo: IFBXGeometryInformations = {
            vertexPositions: geoNode.Vertices?.a ?? [],
            uv: this._parseUVs(geoNode.LayerElementUV),
            vertexIndices: geoNode.PolygonVertexIndex?.a ?? [],
            colors: this._parseColors(geoNode.LayerElementColor),
            normal: this._parseNormals(geoNode.LayerElementNormal),
        };

        const buffers = this._genBuffers(geo);

        return {
            uvs: buffers.uvs,
            indices: buffers.index,
            colors: buffers.colors,
            normals: buffers.normal,
            positions: buffers.vertex,
        };
    }

    /**
     * Generates the buffers according to the 
     */
    private _genBuffers(geoInfo: IFBXGeometryInformations): IFBXBuffers {
        const buffers: IFBXBuffers = {
            uvs: [],
            index: [],
            vertex: [],
            colors: [],
            normal: [],
        };

        let polygonIndex = 0;
        let faceLength = 0;

        // these will hold data for a single face
        let faceUVs: number[] = [];
        let faceColors: number[] = [];
        let faceNormals: number[] = [];
        let facePositionIndexes: number[] = [];

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

            if (geoInfo.colors) {
                var data = this._getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.colors);
                faceColors.push(data[0], data[1], data[2], data[3] ?? 1.0);
            }

            faceLength++;

            if (endOfFace) {
                this._genFace(buffers, geoInfo, facePositionIndexes, faceNormals, faceUVs, faceColors, faceLength);

                polygonIndex++;
                faceLength = 0;

                // reset arrays for the next face
                faceUVs = [];
                faceColors = [];
                faceNormals = [];
                facePositionIndexes = [];
            }
        });

        return buffers;
    }

    /**
     * Generates the face and populates the "buffers" object.
     */
    private _genFace(buffers: IFBXBuffers, geoInfo: IFBXGeometryInformations, facePositionIndexes: number[], faceNormals: number[], faceUVs: number[], faceColors: number[], faceLength: number): void {
        for (var i = 2; i < faceLength; i++) {
            // Positions
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[0]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[1]]);

            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3 + 2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3 + 1]]);

            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i * 3]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i * 3 + 2]]);
            buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i * 3 + 1]]);

            // Colors
            if (geoInfo.colors) {
                buffers.colors.push(faceColors[0]);
                buffers.colors.push(faceColors[1]);
                buffers.colors.push(faceColors[2]);
                buffers.colors.push(faceColors[3]);

                buffers.colors.push(faceColors[(i - 1) * 3]);
                buffers.colors.push(faceColors[(i - 1) * 3 + 1]);
                buffers.colors.push(faceColors[(i - 1) * 3 + 2]);
                buffers.colors.push(faceColors[(i - 1) * 3 + 3]);

                buffers.colors.push(faceColors[i * 3]);
                buffers.colors.push(faceColors[i * 3 + 1]);
                buffers.colors.push(faceColors[i * 3 + 2]);
                buffers.colors.push(faceColors[i * 3 + 3]);
            }

            // Index
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
            referenceType: referenceType,
        };
    }

    /**
     * Parses the UVs of the given uvs node.
     */
    private _parseUVs(uvNode: any): Nullable<IFBXParsedData> {
        if (!uvNode) { return null; }

        const mappingType = uvNode.MappingInformationType;
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
            referenceType: referenceType,
        };
    }

    /**
     * Parses the colors of the given color node.
     */
    private _parseColors(colorNode: any): Nullable<IFBXParsedData> {
        if (!colorNode) { return null; }

        const mappingType = colorNode.MappingInformationType;
        const referenceType = colorNode.ReferenceInformationType;
        const buffer = colorNode.Colors.a;

        let indexBuffer = [];
        if (referenceType === "IndexToDirect") {
            indexBuffer = colorNode.ColorIndex.a;
        }

        return {
            dataSize: 4,
            buffer: buffer,
            indices: indexBuffer,
            mappingType: mappingType,
            referenceType: referenceType,
        };
    }

    /**
     * Returns the data of the given polygon informations.
     */
    private _getData(polygonVertexIndex: number, polygonIndex: number, vertexIndex: number, infoObject: IFBXParsedData): number[] {
        let index: number = polygonVertexIndex;

        switch (infoObject.mappingType) {
            case "ByPolygonVertex": index = polygonVertexIndex; break;
            case "ByPolygon": index = polygonIndex; break;
            case "ByVertice": index = vertexIndex; break;
            case "AllSame": index = infoObject.indices[0]; break;
            default: break;
        }

        if (infoObject.referenceType === "IndexToDirect") {
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
