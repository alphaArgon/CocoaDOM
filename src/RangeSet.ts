/*
 *  RangeSet.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/8/13.
 *  Copyright © 2024 alphaArgon.
 */


/** A type that used to iterate over a set of indices. */
export type IndexSet = Iterable<number>;


/** Returns an iterator that yields numbers in the range `[start, end)`. */
export function *makeRange(start: number, end: number): IndexSet {
    for (let i = start; i < end; i += 1) {
        yield i;
    }
}


export interface ReadonlyRangeSet extends IndexSet {

    readonly count: number;

    readonly first: number | undefined;
    readonly last: number | undefined;

    contains(start: number, end?: number): boolean;

    [Symbol.iterator](): IterableIterator<number>;
    reversed(): IterableIterator<number>;

    ranges(): IterableIterator<[start: number, end: number]>;
    reversedRanges(): IterableIterator<[start: number, end: number]>;

    equals(other: RangeSet): boolean;
    copy(): RangeSet;

    union(other: RangeSet): RangeSet;
    intersection(other: RangeSet): RangeSet;
    difference(other: RangeSet): RangeSet;
    symmetricDifference(other: RangeSet): RangeSet;
}


export class RangeSet implements ReadonlyRangeSet, Iterable<number> {

    private _bounds: number[];  //  [start1, end1, start2, end2, ...], end exclusive
    private _count: number;

    public constructor(start?: number, end?: number) {
        if (start === undefined) {
            this._bounds = [];
            this._count = 0;
            return;
        }

        if (end === undefined) {end = start + 1;}
        if (!(start < end)) {
            this._bounds = [];
            this._count = 0;
            return;
        }

        this._bounds = [start, end];
        this._count = end - start;
    }

    public get count(): number {
        return this._count;
    }

    public get first(): number | undefined {
        if (this._count === 0) {return null as any;}
        return this._bounds[0] as any;
    }

    public get last(): number | undefined {
        if (this._count === 0) {return null as any;}
        return this._bounds[this._bounds.length - 1] - 1 as any;
    }

    public *[Symbol.iterator](): IterableIterator<number> {
        for (let i = 0; i < this._bounds.length; i += 2) {
            let start = this._bounds[i];
            let end = this._bounds[i + 1];
            for (let j = start; j < end; j += 1) {
                yield j;
            }
        }
    }

    public *reversed(): IterableIterator<number> {
        for (let i = this._bounds.length - 2; i >= 0; i -= 2) {
            let start = this._bounds[i];
            let end = this._bounds[i + 1];
            for (let j = end - 1; j >= start; j -= 1) {
                yield j;
            }
        }
    }

    public *ranges(): IterableIterator<[start: number, end: number]> {
        for (let i = 0; i < this._bounds.length; i += 2) {
            yield [this._bounds[i], this._bounds[i + 1]];
        }
    }

    public *reversedRanges(): IterableIterator<[start: number, end: number]> {
        for (let i = this._bounds.length - 2; i >= 0; i -= 2) {
            yield [this._bounds[i], this._bounds[i + 1]];
        }
    }

    public contains(start: number, end: number = start + 1): boolean {
        if (this._count === 0) {return false;}
        if (!(start < end)) {return false;}

        //  Binary search.
        let l = 0, r = this._bounds.length;
        while (l < r) {
            let m = (l + r) >>> 2 << 1;
            let lo = this._bounds[m];
            let hi = this._bounds[m + 1];

            if (end <= lo) {
                r = m;
            } else if (start >= hi) {
                l = m + 2;
            } else {
                return start >= lo && end <= hi;
            }
        }

        return false;
    }

    public insert(start: number, end: number = start + 1): void {
        if (!(start < end)) {return;}

        if (this._count === 0
         || start > this._bounds[this._bounds.length - 1]) {
            this._bounds.push(start, end);
            this._count += end - start;
            return;
        }

        if (start === this._bounds[this._bounds.length - 1]) {
            this._bounds[this._bounds.length - 1] = end;
            this._count += end - start;
            return;
        }

        //  If `start` is contained by, or on the end of a range... Binary search.
        let l = 0, r = this._bounds.length;
        while (l < r) {
            let m = (l + r) >>> 2 << 1;
            let lo = this._bounds[m];
            let hi = this._bounds[m + 1];

            if (start < lo) {
                r = m;
            } else if (start > hi) {
                l = m + 2;
            } else {  //  `start` in `lo...hi`. `hi` is inclusive for convenience of removing joint.
                start = lo;
                l = m; break;
            }
        }

        //  Now, l means the lower bound of indices of `_ranges` to perform replacement.
        r = l;  //  Reuse `r` as the upper bound. `_ranges[l..<r]` will be replaced.
        let removedCount = 0;
        while (r < this._bounds.length) {
            let lo = this._bounds[r];
            if (end < lo) {break;}

            let hi = this._bounds[r + 1];
            r += 2;
            removedCount += hi - lo;

            if (end <= hi) {
                end = hi;
                break;
            }
        }

        this._bounds.splice(l, r - l, start, end);
        this._count += (end - start) - removedCount;
    }

    /** Shifts all elements >= `start` right by `end - start`, and inserts `start..<end`. */
    public insertSpanIn(start: number, end: number): void {
        //  TODO: Optimize.
        this.insertGapIn(start, end);
        this.insert(start, end);
    }

    /** Shifts all elements >= `start` right by `end - start`, which leaves a gap in `start..<end`. */
    public insertGapIn(start: number, end: number): void {
        if (!(start < end)) {return;}
        if (this._count === 0) {return;}

        let delta = end - start;

        //  If `start` is contained by a range... Binary search.
        let l = 0, r = this._bounds.length;
        while (l < r) {
            let m = (l + r) >>> 2 << 1;
            let lo = this._bounds[m];
            let hi = this._bounds[m + 1];

            if (start < lo) {
                r = m;
            } else if (start >= hi) {
                l = m + 2;
            } else {  //  `start` in `lo..<hi`. `hi` is exclusive here, different from `insert`.
                if (start === lo) {
                    l = m; break;
                } else {  //  The range should be split into two disjoint ranges.
                    this._bounds[m + 1] = start;
                    this._bounds.splice(m + 2, 0, end, hi + delta);
                    l = m + 4; break;
                }
            }
        }

        for (let i = l; i < this._bounds.length; i += 2) {
            this._bounds[i] += delta;
            this._bounds[i + 1] += delta;
        }
    }

    /** Returns the index to the lower bound after the removed range, or -1 if removal is invalid. */
    private _remove(start: number, end: number): number {
        if (!(start < end)) {return -1;}
        if (this._count === 0) {return -1;}

        //  If `start` is contained by a range... Binary search.
        let l = 0, r = this._bounds.length;
        while (l < r) {
            let m = (l + r) >>> 2 << 1;
            let lo = this._bounds[m];
            let hi = this._bounds[m + 1];

            if (start < lo) {
                r = m;
            } else if (start >= hi) {
                l = m + 2;
            } else {  //  `start` in `lo..<hi`. `hi` is exclusive here, different from `insert`.
                if (start === lo) {
                    l = m; break;
                } else if (end >= hi) {
                    this._bounds[m + 1] = start;
                    this._count -= hi - start;
                    l = m + 2; break;
                } else {  //  The range should be split into two disjoint ranges.
                    this._bounds[m + 1] = start;
                    this._bounds.splice(m + 2, 0, end, hi);
                    this._count -= end - start;
                    return m + 2;
                }
            }
        }

        //  Now, l means the lower bound of indices of `_ranges` to perform removal.
        r = l;  //  Reuse `r` as the upper bound. `_ranges[l..<r]` will be removed.
        let removedCount = 0;
        while (r < this._bounds.length) {
            let lo = this._bounds[r];
            if (end <= lo) {break;}

            let hi = this._bounds[r + 1];

            if (end < hi) {
                this._bounds[r] = end;
                this._count -= end - lo;
                break;
            }

            r += 2;
            removedCount += hi - lo;
        }

        this._bounds.splice(l, r - l);
        this._count -= removedCount;

        if (this._bounds.length === 0) {
            //  All ranges are removed.
            this._count = 0;
        }

        return l;
    }

    public remove(start: number, end: number = start + 1): void {
        this._remove(start, end);
    }

    /** Removes `start..<end`, and shifts all elements >= `end` left by `end - start`. */
    public removeSpanIn(start: number, end: number): void {
        let l = this._remove(start, end);
        if (l === -1) {return;}

        let delta = end - start;

        for (let i = l; i < this._bounds.length; i += 2) {
            this._bounds[i] -= delta;
            this._bounds[i + 1] -= delta;
        }

        if (l !== 0 && l !== this._bounds.length) {
            //  Check if sibling ranges are joint.
            if (this._bounds[l] === this._bounds[l - 1]) {
                this._bounds.splice(l - 1, 2);
            }
        }
    }

    public removeAll(): void {
        this._bounds.splice(0, this._bounds.length);
        this._count = 0;
    }

    //  Performs XOR operation on each element of the set and in the given range.
    public toggle(start: number, end: number = start + 1): void {
        if (!(start < end)) {return;}

        if (this._count === 0) {
            this._bounds.push(start, end);
            this._count += end - start;
            return;
        }

        //  Binary search for the last bound >= `start`. The bound could be either start or end.
        let l = 0, r = this._bounds.length;
        while (l < r) {
            let m = (l + r) >>> 1;  //  We don't care about the parity of the index.
            let bound = this._bounds[m];
            if (start <= bound) {
                r = m;
            } else {
                l = m + 1;
            }
        }

        //  Also, find the last bound >= `end`.
        //  Count differing might be determined during this loop, but too complicated.
        r = l;
        while (r < this._bounds.length) {
            let bound = this._bounds[r];
            if (end <= bound) {break;}
            r += 1;  //  Again, we don't care about the parity.
        }

        if (l !== this._bounds.length && start === this._bounds[l]) {
            this._bounds.splice(l, 1); r -= 1;
        } else {  //  `start` < `_bounds[l]`.
            this._bounds.splice(l, 0, start); r += 1;
        }

        if (r !== this._bounds.length && end === this._bounds[r]) {
            this._bounds.splice(r, 1);
        } else {  //  `end` < `_bounds[r]`.
            this._bounds.splice(r, 0, end);
        }

        let count = 0;  //  Recalculate count, directly.
        for (let i = 0; i < this._bounds.length; i += 2) {
            count += this._bounds[i + 1] - this._bounds[i];
        }
        this._count = count;
    }

    public equals(other: RangeSet): boolean {
        if (this._bounds === other._bounds) {return true;}
        if (this._bounds.length !== other._bounds.length) {return false;}
        for (let i = 0; i < this._bounds.length; ++i) {
            if (this._bounds[i] !== other._bounds[i]) {return false;}
        }
        return true;
    }

    public assignFrom(other: RangeSet): void {
        this._bounds = other._bounds.slice();
        this._count = other._count;
    }

    public copy(): RangeSet {
        let copy = new RangeSet();
        copy._bounds = this._bounds.slice();
        copy._count = this._count;
        return copy;
    }

    public union(other: RangeSet): RangeSet {
        let result = new RangeSet();
        let bounds = result._bounds;
        let count = 0;

        let lastHi = Number.NaN;  //  When comparing, be careful with NaN!

        let p = 0, q = 0;
        while (p < this._bounds.length && q < other._bounds.length) {
            let thisLo = this._bounds[p];
            let otherLo = other._bounds[q];

            //  Try to add the range with smaller lower bound.
            let lo = 0, hi = 0;
            if (thisLo < otherLo) {
                lo = thisLo;
                hi = this._bounds[p + 1];
                p += 2;
            } else {
                lo = otherLo;
                hi = other._bounds[q + 1];
                q += 2;
            }

            if (hi <= lastHi) {continue;}  //  Already covered.
            if (lo <= lastHi) {  //  Partially covered.
                bounds[bounds.length - 1] = hi;
                count += hi - lastHi;
            } else {  //  Not covered.
                bounds.push(lo, hi);
                count += hi - lo;
            }

            lastHi = hi;
        }

        function addRest(bounds: number[], source: readonly number[], i: number, lastHi: number): number {
            let count = 0;

            //  First check (partially) covered ranges.
            while (i < source.length) {
                let hi = source[i + 1];
                if (hi < lastHi) {i += 2; continue;}  //  Already covered.

                let lo = source[i];
                if (lo <= lastHi) {  //  Partially covered.
                    bounds[bounds.length - 1] = hi;
                    count += hi - lastHi;
                } else {  //  Not covered.
                    bounds.push(lo, hi);
                    count += hi - lo;
                }

                i += 2;
                break;
            }

            //  Now the rest are never covered.
            while (i < source.length) {
                bounds.push(source[i], source[i + 1]);
                count += source[i + 1] - source[i];
                i += 2;
            }

            return count;
        }

        if (p < this._bounds.length) {
            count += addRest(bounds, this._bounds, p, lastHi);
        } else if (q < other._bounds.length) {
            count += addRest(bounds, other._bounds, q, lastHi);
        }

        result._count = count;
        return result;
    }

    public intersection(other: RangeSet): RangeSet {
        let result = new RangeSet();
        let bounds = result._bounds;
        let count = 0;

        //  Intersection is always a subset of any of the two sets.
        //  Therefore, no need to check and merge ranges.
        let p = 0, q = 0;
        while (p < this._bounds.length && q < other._bounds.length) {
            let thisLo = this._bounds[p];
            let thisHi = this._bounds[p + 1];
            let otherLo = other._bounds[q];
            let otherHi = other._bounds[q + 1];

            //  If the two ranges have intersection, append the intersection.
            if (thisHi > otherLo && thisLo < otherHi) {
                let lo = Math.max(thisLo, otherLo);
                let hi = Math.min(thisHi, otherHi);
                bounds.push(lo, hi);
                count += hi - lo;
            }

            //  Move the range with smaller upper bound.
            if (thisHi === otherHi) {
                p += 2;
                q += 2;
            } else if (thisHi < otherHi) {
                p += 2;
            } else {
                q += 2;
            }
        }

        result._count = count;
        return result;
    }

    public difference(other: RangeSet): RangeSet {
        //  TODO: Optimize.
        let result = this.copy();
        for (let i = 0; i < other._bounds.length; i += 2) {
            result.remove(other._bounds[i], other._bounds[i + 1]);
        }

        return result;
    }

    public symmetricDifference(other: RangeSet): RangeSet {
        //  TODO: Optimize.
        let moreRanges: RangeSet, lessRanges: RangeSet;
        this._bounds.length < other._bounds.length
            ? (moreRanges = other, lessRanges = this)
            : (moreRanges = this, lessRanges = other);

        let result = moreRanges.copy();
        for (let i = 0; i < lessRanges._bounds.length; i += 2) {
            result.toggle(lessRanges._bounds[i], lessRanges._bounds[i + 1]);
        }

        return result;
    }
}
