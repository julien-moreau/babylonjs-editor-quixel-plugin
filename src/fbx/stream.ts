export class FBXStream {
    private _buffer: Buffer;
    private _pos: number = 0;

    /**
     * Constructor.
     * @param buffer defines the buffer to stream.
     */
    public constructor(buffer: Buffer) {
        this._buffer = buffer;
    }

    /**
     * Gets the size of the buffer.
     */
    public get size(): number {
        return this._buffer.byteLength;
    }

    /**
     * Gets the current offset.
     */
    public get offset(): number {
        return this._pos
    }

    /**
     * Skips the given amount of bytes.
     * @param amount defines the number of bytes to skip.
     */
    public skip(amount: number): void {
        this._pos += amount;
    }

    /**
     * Reads an returns an unsigned 8 bits integer.
     */
    public readUint8(): number {
        const value = this._buffer.readUInt8(this._pos);
        this._pos += 1;
        return value;
    }

    /**
     * Reads and returns a boolean.
     */
    public readBool(): boolean {
        return (this.readUint8() & 1) === 1;
    }

    /**
     * Reads and returns an array of booleans.
     * @param length defines the length of the array.
     */
    public readBoolArray(length: number): boolean[] {
        const bools: boolean[] = [];
        for (let i = 0; i < length; i++) {
            bools.push(this.readBool());
        }

        return bools;
    }

    /**
     * Reads an returns an unsigned 32 bits integer.
     */
    public readUint32(): number {
        const value = this._buffer.readUInt32LE(this._pos);
        this._pos += 4;
        return value;
    }

    /**
     * Reads and returns a 32 bits integer.
     */
    public readInt32(): number {
        const value = this._buffer.readInt32LE(this._pos);
        this._pos += 4;
        return value;
    }

    /**
     * Reads and returns an array of 32 bits integers.
     * @param length defines the length of the array.
     */
    public readInt32Array(length: number): number[] {
        const numbers: number[] = [];
        for (let i = 0; i < length; i++) {
            numbers.push(this.readInt32());
        }

        return numbers;
    }

    /**
     * Reads and returns an unsigned 64 bits integer.
     */
    public readUint64(): number {
        const low = this.readUint32();
        const high = this.readUint32();

        return high * 0x100000000 + low;
    }

    /**
     * Reads and returns a 16 bits integer.
     */
    public readInt16(): number {
        const value = this._buffer.readInt16LE(this._pos);
        this._pos += 2;

        return value;
    }

    /**
     * Reads and returns a 64 bits integer.
     */
    public readInt64(): number {
        let low = this.readUint32();
        let high = this.readUint32();
        
        // calculate negative value
        if (high & 0x80000000) {
            high = ~ high & 0xFFFFFFFF;
            low = ~ low & 0xFFFFFFFF;

            if (low === 0xFFFFFFFF) {
                high = (high + 1) & 0xFFFFFFFF;
            }

            low = (low + 1) & 0xFFFFFFFF;

            return - (high * 0x100000000 + low);

        }

        return high * 0x100000000 + low;
    }

    /**
     * Reads and returns an array of 64 bits integers.
     * @param length defines the length of the array.
     */
    public readInt64Array(length: number): number[] {
        const numbers: number[] = [];
        for (let i = 0; i < length; i++) {
            numbers.push(this.readInt64());
        }

        return numbers;
    }

    /**
     * Reads and returns a floating point number.
     */
    public readFloat32(): number {
        const value = this._buffer.readFloatLE(this._pos);
        this._pos += 4;
        return value;
    }

    /**
     * Reads and returns a double floating point number.
     */
    public readFloat64(): number {
        const value = this._buffer.readDoubleLE(this._pos);
        this._pos += 8;
        return value;
    }

    /**
     * Reads and returns an array of 32 bits floating point numbers.
     * @param length defines the length of the array.
     */
    public readFloat32Array(length: number): number[] {
        const numbers: number[] = [];
        for (let i = 0; i < length; i++) {
            numbers.push(this.readFloat32());
        }
        return numbers;
    }

    /**
     * Reads and returns an array of 64 bits floating point numbers.
     * @param length defines the length of the array.
     */
    public readFloat64Array(length: number): number[] {
        const numbers: number[] = [];
        for (let i = 0; i < length; i++) {
            numbers.push(this.readFloat64());
        }
        return numbers;
    }

    /**
     * Reads and returns a string of the given length.
     * @param length defines the length of the string.
     */
    public readString(length: number): string {
        const str = this._buffer.toString("utf-8", this._pos, this._pos + length);
        this._pos += length;
        return str;
    }

    /**
     * Reads and returns an array buffer of the given length.
     * @param length defines the length of the array buffer.
     */
    public readArrayBuffer(length: number): Buffer {
        const buffer = this._buffer.subarray(this._pos, this._pos + length);
        this._pos += length;
        return buffer;
    }
}
