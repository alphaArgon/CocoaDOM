/*
 *  AppearanceAdjust.ts
 *  CocoaDOM
 *
 *  Created by alpha on 2024/12/6.
 *  Copyright © 2024 alphaArgon.
 */


function *dfs(root, childrenKey) {
    yield root;
    for (let child of root[childrenKey]) {
        yield *dfs(child, childrenKey);
    }
}


function *dfsStack(root, childrenKey) {
    let stack = [root];
    do {
        let node = stack.pop();
        yield node;
        stack.push(...node[childrenKey]);
    } while (stack.length);
}


function *bfs0(root, childrenKey) {
    let queue = [root];
    do {
        let node = queue.shift();
        yield node;
        queue.push(...node[childrenKey]);
    } while (queue.length);
}


function *bfsN(root, childrenKey, delayShift) {
    let queue = [root];
    let head = 0;
    do {
        let node = queue[head];
        yield node;
        queue.push(...node[childrenKey]);
        
        head += 1;
        if (head === delayShift) {
            queue.splice(0, delayShift);
            head = 0;
        }
    } while (head < queue.length);
}


function *bfsLinkedList(root, childrenKey) {
    let head = {node: root, next: null};
    let tail = head;

    do {
        let node = head.node;
        yield node;

        for (let child of node[childrenKey]) {
            tail = tail.next = {node: child, next: null};
        }

        head = head.next;
    } while (head !== null);
}


function makeRandomTree(depth, degree) {
    let node = {
        data: Math.round(Math.random() * 100),
        children: []
    };

    if (depth !== 0)
    for (let i = 0; i < degree; i++) {
        node.children.push(makeRandomTree(depth - 1, degree));
    }

    return node;
}


const testTree = makeRandomTree(7, 5);
const repeatCount = 10;

let acc = 0;

console.time('dfs');
for (let i = 0; i < repeatCount; ++i) {
    for (let node of dfs(testTree, 'children')) {acc += node.data;}
}
console.timeEnd('dfs');

{
    let bcc = 0;
    console.time('dfsStack');
    for (let i = 0; i < repeatCount; ++i) {
        for (let node of dfsStack(testTree, 'children')) {bcc += node.data;}
    }
    console.timeEnd('dfsStack');
    console.assert(acc === bcc);
}


{
    let bcc = 0;
    console.time('bfs0');
    for (let i = 0; i < repeatCount; ++i) {
        for (let node of bfs0(testTree, 'children')) {bcc += node.data;}
    }
    console.timeEnd('bfs0');
    console.assert(acc === bcc);
}

for (let n of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]) {
    let bcc = 0;
    console.time(`bfs${n}`);
    for (let i = 0; i < repeatCount; ++i) {
        for (let node of bfsN(testTree, 'children', n)) {bcc += node.data;}
    }
    console.timeEnd(`bfs${n}`);
    console.assert(acc === bcc);
}

{
    let bcc = 0;
    console.time('bfsLinkedList');
    for (let i = 0; i < repeatCount; ++i) {
        for (let node of bfsLinkedList(testTree, 'children')) {bcc += node.data;}
    }
    console.timeEnd('bfsLinkedList');
    console.assert(acc === bcc);
}


//  Run on Apple M2 Max (macOS Ventura 13.7):

//  Chrome as webpage:
//  dfs: 194.81591796875 ms
//  bfs0: 3699.635009765625 ms
//  bfs2: 2443.220947265625 ms
//  bfs4: 1007.078857421875 ms
//  bfs8: 326.177001953125 ms
//  bfs16: 230.5390625 ms
//  bfs32: 100.638916015625 ms
//  bfs64: 63.23486328125 ms
//  bfs128: 43.427978515625 ms
//  bfs256: 32.673095703125 ms
//  bfs512: 28.18701171875 ms
//  bfs1024: 25.643798828125 ms
//  bfs2048: 23.906982421875 ms
//  bfsLinkedList: 21.06787109375 ms

//  Safari as webpage:
//  dfs: 200.060ms
//  bfs0: 93.293ms
//  bfs2: 2562.686ms
//  bfs4: 1320.793ms
//  bfs8: 691.699ms
//  bfs16: 372.361ms
//  bfs32: 201.067ms
//  bfs64: 126.373ms
//  bfs128: 84.393ms
//  bfs256: 63.052ms
//  bfs512: 60.722ms
//  bfs1024: 51.898ms
//  bfs2048: 47.684ms
//  bfsLinkedList: 73.208ms

//  Firefox as webpage:
//  dfs: 460ms
//  bfs0: 73ms
//  bfs2: 87ms
//  bfs4: 82ms
//  bfs8: 76ms
//  bfs16: 75ms
//  bfs32: 73ms
//  bfs64: 73ms
//  bfs128: 72ms
//  bfs256: 74ms
//  bfs512: 77ms
//  bfs1024: 82ms
//  bfs2048: 69ms
//  bfsLinkedList: 61ms

//  It seems that linked list is a better choice for BFS traversal. It’s quite surprising linked
//  list *in JavaScript* is faster than array.
