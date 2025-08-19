const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');

const img = new Image();
img.src = 'test.jpg';

// TODO:
// Switch to modes:
//  n: new region or node?
//  d: delete region or node?
//  m: move region
//  e: edit region
//  c: close region?
//  some way to delete a node
//  draw a box at the first Node in a region
//  to click to close a region; double click
//  should remove the last node?
const state = {
    x: 0,
    y: 0,
    regions: new Set(),
    highlightedRegion: null,
    selectedRegion: null,
    newRegion: null,
    mousedown: false,
}

stage.addEventListener('mousemove', e => {
    state.x = e.offsetX;
    state.y = e.offsetY;
});


stage.addEventListener('mousedown', e => {
    state.mousedown = true;
});

stage.addEventListener('mouseup', e => {
    state.mousedown = false;

    if (state.highlightedRegion != null){
        state.selectedRegion = state.highlightedRegion;
        return
    }

    state.selectedRegion = null;

    if (state.newRegion == null){
        state.newRegion = new Region();
    }
    state.newRegion.addPoint(state.x, state.y);
});

stage.addEventListener('dblclick', e => {
    if (state.newRegion.nodes.length > 3){
        // remove the Node added by the click before the double
        state.newRegion.nodes.pop();
        state.newRegion.closed = true;
        state.regions.add(state.newRegion);
    }
    state.newRegion = null;
});

window.addEventListener('keydown', e => {
    switch (e.key){
    case 'Escape':
        state.newRegion = null;
        break;
    case 'x':
        state.regions.delete(state.selectedRegion);
        state.selectedRegion = null;
    }
})

const draw = t => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, stage.width, stage.height);
    ctx.drawImage(img, 10, 10);

    state.regions.forEach(r => {
        if (r.isPointInside(ctx, state.x, state.y)){
            // TODO: only if region is smaller than current highlighted region
            state.highlightedRegion = r;
        } else if (state.highlightedRegion == r){
            state.highlightedRegion = null;
        }
    });

    state.regions.forEach(r => {
        if (state.mousedown && state.selectedRegion == r){
            r.mousedown(ctx, state.x, state.y); 
        } else {
            r.mouseup();
        }
        r.draw(ctx, state.highlightedRegion == r, state.selectedRegion == r);
    });

    if (state.newRegion != null){
        state.newRegion.draw(ctx);
    }

    requestAnimationFrame(draw);
};

requestAnimationFrame(draw);


class Node {
    highlighted = false;
    selected = false;
    size = 8

    constructor(x, y){
        this.x = x;
        this.y = y;
    }

    isPointInside(ctx, x, y){
        return ctx.isPointInPath(this.path(), x, y); 
    }

    path(){
        let path = new Path2D();
        path.rect(
            this.x - this.size/2,
            this.y - this.size/2,
            this.size,
            this.size
        );
        return path
    }

    draw(ctx){
        ctx.fillStyle = 'red';
        ctx.fill(this.path())
    }
}

class Region {
    nodes = [];
    closed = false;
    selectedNode = null;

    mouseup() {
        this.selectedNode = null;
    }

    mousedown(ctx, x, y){
        if (this.selectedNode == null){
            let n = this.nodes.filter(n => n.isPointInside(ctx, x, y))
            if (n.length == 0){
                return;
            }
            this.selectedNode = n[0];
        }

        this.selectedNode.x = x;
        this.selectedNode.y = y;
    }

    addPoint(x, y){
        this.nodes.push(new Node(x, y));
    }

    isPointInside(ctx, x, y){
        if (ctx.isPointInPath(this.path(), x, y)){
            return true;
        }

        for (let i = 0; i < this.nodes.length; i++){
            if (this.nodes[i].isPointInside(ctx, x, y)){
                return true;
            }
        }
        
        return false;
    }

    path(){
        let path = new Path2D();
        if (this.nodes.length == 0){
            return path;
        }

        path.moveTo(this.nodes[0].x, this.nodes[0].y);
        for (let i = 1; i < this.nodes.length; i++){
            let p = this.nodes[i]; 
            path.lineTo(p.x, p.y);
        }

        if (this.closed){
            path.closePath();
        } else {
            path.lineTo(state.x, state.y);
        }

        return path;
    }

    draw(ctx, highlighted, selected){
        let p = this.path();

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
        ctx.stroke(p);

        ctx.fillStyle = 'rgba(255 0 0 / 20%)'
        if (highlighted || selected){
            ctx.fillStyle = 'rgba(255 0 0 / 40%)'
        }

        if (this.closed){
            ctx.fill(p)
        }

        if (selected){
            this.nodes.forEach(n => n.draw(ctx))
        }
    }
}
