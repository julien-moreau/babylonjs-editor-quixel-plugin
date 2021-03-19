// Shamely inspired by THREE.js FBX Loader: https://github.com/mrdoob/three.js/blob/83f334bd91d7870b2e2266e70791dd1265c98467/examples/jsm/loaders/FBXLoader.js

import { Nullable, IStringDictionary } from "babylonjs-editor/shared/types";
import { inflateSync } from "zlib";

import { FBXStream } from "./stream";
import { FBXGeometry } from "./geometry";
import { IFBXNode, IFBXGeometry } from "./types";

export class FBXLoader {
    private _stream: FBXStream;

    /**
     * Returns wether or not the given FBX buffer is valid.
     * @param buffer defines the FBX buffer previously loaded.
     */
    public static IsValidFBX(buffer: Buffer): boolean {
        return buffer.byteLength < this._Magic.length || buffer.toString("utf-8", 0, buffer.length) !== this._Magic;
    }

    private static _Magic: string = "Kaydara FBX Binary  \0";

    /**
     * Defines the version of the parsed FBX file.
     */
    public readonly version: number;

    /**
     * Constructor.
     * @param content defines the FBX binary content.
     */
    public constructor(content: Buffer) {
        this._stream = new FBXStream(content);
        this._stream.skip(23);

        this.version = this._stream.readUint32();
    }

    /**
     * Parses the FBX file.
     */
    public parse(): Nullable<IFBXGeometry[]> {
        const nodes: IStringDictionary<IFBXNode> = {};
        while (!this._isEndOfContent()) {
            const node = this._parseNode();
            if (node?.name) {
                nodes[node.name] = node;
            }
        }

        // Create geometries
        const geometry = nodes["Objects"]["Geometry"]
        if (!geometry) { return null; }

        return new FBXGeometry().parse(geometry);
    }

    /**
     * Parses the current node according to the stream.
     */
    private _parseNode(): Nullable<IFBXNode> {
        const endOffset = (this.version >= 7500) ? this._stream.readUint64() : this._stream.readUint32();
        const numProperties = (this.version >= 7500) ? this._stream.readUint64() : this._stream.readUint32();

        // the returned propertyListLen is not used
        (this.version >= 7500) ? this._stream.readUint64() : this._stream.readUint32();

        const nameLen = this._stream.readUint8();
        const name = this._stream.readString(nameLen);

        // Regards this node as NULL-record if endOffset is zero
        if (endOffset === 0) { return null; }

        // Read properties
        const propertyList: any[] = [];
        for (let i = 0; i < numProperties; i++) {
            propertyList.push(this._parseProperty());
        }

        // Regards the first three elements in propertyList as id, attrName, and attrType
        const id = propertyList.length > 0 ? propertyList[0] : "";
        const attrName = propertyList.length > 1 ? propertyList[1] : "";
        const attrType = propertyList.length > 2 ? propertyList[2] : "";

        // check if this node represents just a single property
        // like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}
        const node: IFBXNode = {
            singleProperty: (numProperties === 1 && this._stream.offset === endOffset) ? true : false,
        };

        while (endOffset > this._stream.offset) {
            const subNode = this._parseNode();

            if (subNode) {
                this._parseSubNode(name, node, subNode);
            }
        }

        node.propertyList = propertyList; // raw property list used by parent

        if (typeof id === "number") { node.id = id.toString(); }
        if (attrName !== "") { node.attrName = attrName; }
        if (attrType !== "") { node.attrType = attrType; }
        if (name !== "") { node.name = name; }

        return node;
    }

    private _parseSubNode(name: string, node: IFBXNode, subNode: IFBXNode): void {
        // special case: child node is single property
        if (subNode.singleProperty === true) {
            const value = subNode.propertyList![0];

            if (Array.isArray(value)) {
                node[subNode.name!] = subNode;
                subNode.a = value;
            } else {
                node[subNode.name!] = value;
            }

        } else if (name === "Connections" && subNode.name === "C") {
            const array: any[] = [];
            subNode.propertyList!.forEach((property, i) => {
                // first Connection is FBX type (OO, OP, etc.). We'll discard these
                if (i !== 0) {
                    array.push(property);
                }
            });

            if (node.connections === undefined) {
                node.connections = [];
            }

            node.connections.push(array);

        } else if (subNode.name === "Properties70") {
            const keys = Object.keys(subNode);
            keys.forEach(function (key) {
                node[key] = subNode[key];
            });

        } else if (name === "Properties70" && subNode.name === "P") {
            var innerPropName = subNode.propertyList![0];
            var innerPropType1 = subNode.propertyList![1];
            var innerPropType2 = subNode.propertyList![2];
            var innerPropFlag = subNode.propertyList![3];
            var innerPropValue;

            if (innerPropName.indexOf("Lcl ") === 0) innerPropName = innerPropName.replace("Lcl ", "Lcl_");
            if (innerPropType1.indexOf("Lcl ") === 0) innerPropType1 = innerPropType1.replace("Lcl ", "Lcl_");

            if (innerPropType1 === "Color" || innerPropType1 === "ColorRGB" || innerPropType1 === "Vector" || innerPropType1 === "Vector3D" || innerPropType1.indexOf("Lcl_") === 0) {
                innerPropValue = [
                    subNode.propertyList![4],
                    subNode.propertyList![5],
                    subNode.propertyList![6]
                ];
            } else {
                innerPropValue = subNode.propertyList![4];
            }

            // this will be copied to parent, see above
            node[innerPropName] = {
                "type": innerPropType1,
                "type2": innerPropType2,
                "flag": innerPropFlag,
                "value": innerPropValue
            };
        } else if (node[subNode.name!] === undefined) {
            if (typeof subNode.id === "number") {
                node[subNode.name!] = {};
                node[subNode.name!][subNode.id] = subNode;
            } else {
                node[subNode.name!] = subNode;
            }

        } else {
            if (subNode.name === "PoseNode") {
                if (!Array.isArray(node[subNode.name])) {
                    node[subNode.name] = [node[subNode.name]];
                }

                node[subNode.name].push(subNode);
            } else if (node[subNode.name!][subNode.id] === undefined) {
                node[subNode.name!][subNode.id] = subNode;
            }

        }
    }

    /**
     * Parses the current property according to the stream.
     */
    private _parseProperty(): any {
        const type = this._stream.readString(1);
        switch (type) {
            // Boolean
            case "C": return this._stream.readBool();
            // UInt32
            case "I": return this._stream.readUint32();
            // String
            case "S": return this._stream.readString(this._stream.readUint32());
            // Int64
            case "L": return this._stream.readInt64();
            // Float 32
            case "F": return this._stream.readFloat32();
            // Float 64
            case "D": return this._stream.readFloat64();
            // Array buffer
            case "R": return this._stream.readArrayBuffer(this._stream.readUint32());

            case "b":
            case "c":
            case "d":
            case "f":
            case "i":
            case "l":
                const arrayLength = this._stream.readUint32();
                const encoding = this._stream.readUint32(); // 0: non-compressed, 1: compressed
                const compressedLength = this._stream.readUint32();

                if (encoding === 0) {
                    switch (type) {
                        case "b":
                        case "c": return this._stream.readBoolArray(arrayLength);
                        case "d": return this._stream.readFloat64Array(arrayLength);
                        case "f": return this._stream.readFloat32Array(arrayLength);
                        case "i": return this._stream.readInt32Array(arrayLength);
                        case "l": return this._stream.readInt64Array(arrayLength);
                    }
                }

                const inflate = inflateSync(this._stream.readArrayBuffer(compressedLength));
                const stream = new FBXStream(inflate);
                switch (type) {
                    case "b":
                    case "c": return stream.readBoolArray(arrayLength);
                    case "d": return stream.readFloat64Array(arrayLength);
                    case "f": return stream.readFloat32Array(arrayLength);
                    case "i": return stream.readInt32Array(arrayLength);
                    case "l": return stream.readInt64Array(arrayLength);
                }
            default:
                throw new Error(`Parse property not implemented for property type: "${type}"`);
        }
    }

    /**
     * Returns wether or not the loader is at the end of file.
     */
    private _isEndOfContent(): boolean {
        // footer size: 160bytes + 16-byte alignment padding
        // - 16bytes: magic
        // - padding til 16-byte alignment (at least 1byte?)
        //	(seems like some exporters embed fixed 15 or 16bytes?)
        // - 4bytes: magic
        // - 4bytes: version
        // - 120bytes: zero
        // - 16bytes: magic
        if (this._stream.size % 16 === 0) {
            return ((this._stream.offset + 160 + 16) & ~0xf) >= this._stream.size;
        } else {
            return this._stream.offset + 160 + 16 >= this._stream.size;
        }
    }
}
