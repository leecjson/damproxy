'use strict';

class ByteBuffer {
  /**
   * 
   * @param {number|Buffer} p 
   */
  constructor(p) {
    switch (typeof p) {
      case 'number':
        /**
         * @type {Buffer}
         */
        this._buf = Buffer.allocUnsafe(p);
        break;
      case 'object':
        if (p instanceof Buffer) {
          this._buf = p;
        } else {
          throw new Error('invalid');
        }
      case 'undefined':
        break;
      default:
        throw new Error('invalid');
    }
    
    /**
     * @type {number}
     */
    this._readOffset = 0;
    /**
     * @type {number}
     */
    this._writeOffset = 0;
  }

  writeInt8(value) { this._buf.writeInt8(value, this._writeOffset); this._writeOffset += 1; return this; }
  writeInt16LE(value) { this._buf.writeInt16LE(value, this._writeOffset); this._writeOffset += 2; return this; }
  writeInt16BE(value) { this._buf.writeInt16BE(value, this._writeOffset); this._writeOffset += 2; return this; }
  writeInt32LE(value) { this._buf.writeInt32LE(value, this._writeOffset); this._writeOffset += 4; return this; }
  writeInt32BE(value) { this._buf.writeInt32BE(value, this._writeOffset); this._writeOffset += 4; return this; }
  writeInt64LE(value) { this._buf.writeBigInt64LE(value, this._writeOffset); this._writeOffset += 8; return this; }
  writeInt64BE(value) { this._buf.writeBigInt64BE(value, this._writeOffset); this._writeOffset += 8; return this; }
  writeUInt8(value) { this._buf.writeUInt8(value, this._writeOffset); this._writeOffset += 1; return this; }
  writeUInt16LE(value) { this._buf.writeUInt16LE(value, this._writeOffset); this._writeOffset += 2; return this; }
  writeUInt16BE(value) { this._buf.writeUInt16BE(value, this._writeOffset); this._writeOffset += 2; return this; }
  writeUInt32LE(value) { this._buf.writeUInt32LE(value, this._writeOffset); this._writeOffset += 4; return this; }
  writeUInt32BE(value) { this._buf.writeUInt32BE(value, this._writeOffset); this._writeOffset += 4; return this; }
  writeUInt64LE(value) { this._buf.writeBigUInt64LE(value, this._writeOffset); this._writeOffset += 8; return this; }
  writeUInt64BE(value) { this._buf.writeBigUInt64BE(value, this._writeOffset); this._writeOffset += 8; return this; }
  writeFloatLE(value) { this._buf.writeFloatLE(value, this._writeOffset); this._writeOffset += 4; return this; }
  writeFloatBE(value) { this._buf.writeFloatBE(value, this._writeOffset); this._writeOffset += 4; return this; }
  writeDoubleLE(value) { this._buf.writeDoubleLE(value, this._writeOffset); this._writeOffset += 8; return this; }
  writeDoubleBE(value) { this._buf.writeDoubleBE(value, this._writeOffset); this._writeOffset += 8; return this; }


  readInt8() { const v = this._buf.readInt8(this._readOffset); this._readOffset += 1; return v; }
  readInt16LE() { const v = this._buf.readInt16LE(this._readOffset); this._readOffset += 2; return v; }
  readInt16BE() { const v = this._buf.readInt16BE(this._readOffset); this._readOffset += 2; return v; }
  readInt32LE() { const v = this._buf.readInt32LE(this._readOffset); this._readOffset += 4; return v; }
  readInt32BE() { const v = this._buf.readInt32BE(this._readOffset); this._readOffset += 4; return v; }
  readInt64LE() { const v = this._buf.readBigInt64LE(this._readOffset); this._readOffset += 8; return v; }
  readInt64BE() { const v = this._buf.readBigInt64BE(this._readOffset); this._readOffset += 8; return v; }
  readUInt8() { const v = this._buf.readUInt8(this._readOffset); this._readOffset += 1; return v; }
  readUInt16LE() { const v = this._buf.readUInt16LE(this._readOffset); this._readOffset += 2; return v; }
  readUInt16BE() { const v = this._buf.readUInt16BE(this._readOffset); this._readOffset += 2; return v; }
  readUInt32LE() { const v = this._buf.readUInt32LE(this._readOffset); this._readOffset += 4; return v; }
  readUInt32BE() { const v = this._buf.readUInt32BE(this._readOffset); this._readOffset += 4; return v; }
  readUInt64LE() { const v = this._buf.readBigUInt64LE(this._readOffset); this._readOffset += 8; return v; }
  readUInt64BE() { const v = this._buf.readBigUInt64BE(this._readOffset); this._readOffset += 8; return v; }
  readFloatLE() { const v = this._buf.readFloatLE(this._readOffset); this._readOffset += 4; return v; }
  readFloatBE() { const v = this._buf.readFloatBE(this._readOffset); this._readOffset += 4; return v; }
  readDoubleLE() { const v =this._buf.readDoubleLE(this._readOffset); this._readOffset += 8; return v; }
  readDoubleBE() { const v = this._buf.readDoubleBE(this._readOffset); this._readOffset += 8; return v; }

  /**
   * 
   * @param {Buffer|ByteBuffer} p1 
   * @param {number} p1 
   * @param {number} p2 
   */
  write(p1, p2, p3) {
    if (p1 instanceof Buffer) {
      const rawBuffer = p1;
      let start = p2, end = p3;
      if (start == undefined) start = 0;
      if (end == undefined) end = rawBuffer.length;

      rawBuffer.copy(this._buf, this._writeOffset, start, end);
      this._writeOffset += (end - start);
    } else if (p1 instanceof ByteBuffer) {
      const anthorBuffer = p1;
      let length = p2;
      if (length == undefined) length = anthorBuffer.readableLength;

      anthorBuffer._buf.copy(
        this._buf,
        this._writeOffset,
        anthorBuffer._readOffset,
        anthorBuffer._readOffset + length);

      this._writeOffset += length;
      anthorBuffer._readOffset += length;
    } else {
      throw new Error('invalid buffer');
    }
    return this;
  }
  
  /**
   * 
   * @param {Buffer} p 
   */
  set(p) {
    this._buf = p;
    this.resetOffset();
  }

  resetOffset() {
    this._writeOffset = 0;
    this._readOffset = 0;
  }

  // get writtenBuffer() {
  //   if (this._writeOffset > 0) {
  //     const rawbuf = Buffer.allocUnsafe(this._writeOffset);
  //     this._buf.copy(newbuf, 0, 0, this._writeOffset);
  //     return rawbuf;
  //   }
  // }

  get buffer() { return this._buf; }
  get length() { return this._buf.length; }
  get readableLength() { return this._buf.length - this._readOffset; }
  get writableLength() { return this._buf.length - this._writeOffset; }
  set readOffset(val) { this._readOffset = val; }
  set writeOffset(val) { this._writeOffset = val; }
  get readOffset() { return this._readOffset; }
  get writeOffset() { return this._writeOffset; }
}

module.exports = ByteBuffer;