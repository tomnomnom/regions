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

    if (state.highlightedRegion != null){
        state.selectedRegion = state.highlightedRegion;
        return;
    }

    if (state.selectedRegion != null){
        state.selectedRegion = null;
        return;
    }
});

stage.addEventListener('mouseup', e => {
    state.mousedown = false;

    if (state.highlightedRegion != null){
        return;
    }
    
    if (state.newRegion != null){
        state.newRegion.addNode(state.x, state.y);
        return;
    }

    state.newRegion = new Region();
    state.newRegion.addNode(state.x, state.y);
});

stage.addEventListener('dblclick', e => {
    if (state.newRegion == null){
        return;
    }

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
    case 'd':
        if (state.selectedRegion == null){
            break;
        }
        const duplicate = state.selectedRegion.clone();
        duplicate.moveRelative(20, 20);
        state.regions.add(duplicate);
        state.selectedRegion = duplicate;
        break;
    case 'h':
        if (state.selectedRegion != null){
            state.selectedRegion.moveRelative(-1, 0);
        }
        break;
    case 'j':
        if (state.selectedRegion != null){
            state.selectedRegion.moveRelative(0, 1);
        }
        break;
    case 'k':
        if (state.selectedRegion != null){
            state.selectedRegion.moveRelative(0, -1);
        }
        break;
    case 'l':
        if (state.selectedRegion != null){
            state.selectedRegion.moveRelative(1, 0);
        }
        break;
    }
})

const draw = t => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, stage.width, stage.height);
    ctx.drawImage(img, 10, 10);

    state.highlightedRegion = null;

    state.regions.forEach(r => {
        if (r.isPointInside(ctx, state.x, state.y)){
            // TODO: only if region is smaller than current highlighted region
            state.highlightedRegion = r;
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
    size = 4

    constructor(x, y){
        this.x = x;
        this.y = y;
    }

    toJSON(){
        return {
            x: this.x,
            y: this.y,
        };
    }

    static fromObj(obj){
        if (!obj.hasOwnProperty("x") || !obj.hasOwnProperty("y")){
            throw new Error("Node obj must have x and y values");
        }
        return new Node(obj.x, obj.y);
    }

    isPointInside(ctx, x, y){
        return ctx.isPointInPath(this.path(), x, y); 
    }

    path(){
        let path = new Path2D();
        path.arc(this.x, this.y, this.size, 0, Math.PI*2);
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
    editMode = null;
    moveState = {
        lastX: 0,
        lastY: 0,
    };

    clone(){
        const c = new Region();
        this.nodes.forEach(n => c.addNode(n.x, n.y));
        c.closed = true;
        return c;
    }

    toJSON(){
        return {
            nodes: this.nodes,
        };
    }

    static fromJSON(raw){
        const p = JSON.parse(raw)
        if (!p.hasOwnProperty("nodes")){
            throw new Error("no nodes in Region JSON")
        }
        let r = new Region();
        r.nodes = p.nodes.map(n => Node.fromObj(n));
        r.closed = true;
        return r;
    }

    mouseup(){
        this.selectedNode = null;
        this.editMode = null;
    }

    mousedown(ctx, x, y){
        switch (this.editMode){

        case "node":
            this.selectedNode.x = x;
            this.selectedNode.y = y;
            break;

        case "move":
            let dx = x - this.moveState.lastX;
            let dy = y - this.moveState.lastY;

            this.moveRelative(dx, dy);

            this.moveState.lastX = x;
            this.moveState.lastY = y;
            break;

        case null:
            let n = this.nodes.filter(n => n.isPointInside(ctx, x, y))
            if (n.length > 0){
                this.editMode = "node";
                this.selectedNode = n[0];
                return
            }
            
            if (ctx.isPointInPath(this.path(), x, y)){
                this.editMode = "move";
                this.moveState.lastX = x;
                this.moveState.lastY = y;
                return
            }

            break;
        }

    }

    moveRelative(dx, dy){
        this.nodes.forEach(n => {
            n.x += dx;
            n.y += dy;
        })
    }

    addNode(x, y){
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

        ctx.strokeStyle = 'red';

        ctx.fillStyle = 'rgba(255 0 0 / 20%)'
        if (highlighted || selected){
            ctx.fillStyle = 'rgba(255 0 0 / 40%)'
        }

        ctx.lineWidth = 1;

        if (this.closed){
            ctx.fill(p)
        } else {
            ctx.lineWidth = 2;
        }

        ctx.stroke(p);

        if (selected){
            this.nodes.forEach(n => n.draw(ctx))
        }
    }
}
