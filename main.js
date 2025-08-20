const strokeStyle = 'rgba(255 255 255 / 70%)';
const nodeFillStyle = 'rgba(255 255 255 / 100%)';
const regionStyle = 'rgba(255 255 255 / 20%)';
const highlightStyle = 'rgba(255 255 255 / 30%)';

const nodeSize = 4;

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
    deselected: false,
};

const saveButton = document.getElementById('save');
const restoreButton = document.getElementById('restore');

saveButton.addEventListener('click', e => {
    saveButton.disabled = true;

    fetch('/save.php', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify([...state.regions]),
    }).then(r => {
        saveButton.disabled = false;
    })
});

restoreButton.addEventListener('click', e => {
    restoreButton.disabled = true;

    fetch('/restore.php').then(r => r.json()).then(regions => {

        state.regions = new Set();
        state.highlightedRegion = null;
        state.selectedRegion = null;
        state.newRegion = null;

        regions.forEach(r => {
            state.regions.add(Region.fromObj(r));
        })

        restoreButton.disabled = false;
    });

});

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
        state.deselected = true;
        return;
    }
});

stage.addEventListener('mouseup', e => {
    state.mousedown = false;

    if (state.deselected){
        state.deselected = false;
        return;
    }

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

    if (state.selectedRegion != null){
        state.selectedRegion.dblclick(ctx, state.x, state.y);
        return;
    }

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
    if (stage.width != img.width || stage.height != img.height){
        stage.width = img.width;
        stage.height = img.height;
    }

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, stage.width, stage.height);
    ctx.drawImage(img, 0, 0);

    state.highlightedRegion = null;

    state.regions.forEach(r => {
        if (state.newRegion == null && r.isPointInside(ctx, state.x, state.y)){
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
    size = nodeSize;

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
        ctx.fillStyle = nodeFillStyle;
        ctx.fill(this.path())
    }

    distance(n){
        return Math.abs(Math.sqrt(Math.pow(this.x - n.x, 2) + Math.pow(this.y - n.y, 2)));
    }

    midpoint(n){
        return new Node(
            this.x + (n.x - this.x)/2,
            this.y + (n.y - this.y)/2,
        );
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

    static fromObj(obj){
        if (!obj.hasOwnProperty("nodes")){
            throw new Error("no nodes in object")
        }
        let r = new Region();
        r.nodes = obj.nodes.map(n => Node.fromObj(n));
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
            let n = this.nodes.find(n => n.isPointInside(ctx, x, y))
            if (n != undefined){
                this.editMode = "node";
                this.selectedNode = n;
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

    dblclick(ctx, x, y){
        let i = this.nodes.findIndex(n => n.isPointInside(ctx, x, y));
        if (i >= 0){
            this.deleteNode(i);
            return;
        }

        let lowest = {
            index: -1,
            distance: Infinity,
        };

        for (let i = 0; i < this.nodes.length; i++){
            let j = i+1;
            if (j == this.nodes.length){
                j = 0;
            }
            
            //     p3
            //     /|
            //    / | distance
            //   /  |
            //  p1------p2
            let p1 = this.nodes[i];
            let p2 = this.nodes[j];
            let p3 = new Node(x, y);

            let mid = p1.midpoint(p2);

            if (p3.distance(mid) > p1.distance(p2)/2){
                continue;
            }

            let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) -
                        Math.atan2(p3.y - p1.y, p3.x - p1.x);

            let distance = Math.abs(Math.tan(angle) * p3.distance(p1));

            if (distance < lowest.distance){
                lowest.distance = distance;
                lowest.index = i;
            }
        }
        
        if (lowest.distance == Infinity){
            return;
        }

        this.nodes = this.nodes.toSpliced(lowest.index+1, 0, new Node(x, y));
    }

    deleteNode(i){
        this.selectedNode = null;
        this.nodes = this.nodes.toSpliced(i, 1);

        if (this.nodes.length < 3){
            state.regions.delete(this);
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

        ctx.strokeStyle = strokeStyle;

        ctx.fillStyle = regionStyle;
        if (highlighted || selected){
            ctx.fillStyle = highlightStyle;
        }

        ctx.lineWidth = 1;

        if (this.closed){
            ctx.fill(p)
        } else {
            ctx.lineWidth = 2;
            ctx.stroke(p);
        }

        if (selected){
            ctx.stroke(p);
            this.nodes.forEach(n => n.draw(ctx))
        }
    }
}
