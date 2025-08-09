const canvas = document.getElementById("tela");
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const container = document.querySelector(".canvas-container");

const tools = {
    BRUSH: funcs = {
        TOOL: draw,
        TOGGLE: toggleBrush,

    },
    ERASER: funcs = {
        TOOL: erase,
        TOGGLE: toggleEraser,
    },
    DRAG: funcs = {
        TOOL: drag,
        TOGGLE: toggleDrag,
    }
}

const cursor = document.getElementById("customCursor");
const canvasWidth = 10000;
const canvasHeight = 10000;
const backgroundColor = "#ffffff";
let brushSize = 7;
updateCursor(brushSize);

canvas.width = canvasWidth;
canvas.height = canvasHeight;

window.addEventListener("load", () => {
    console.log("Canvas loaded");
    clearCanvas();
});

let color = document.getElementById("colorPicker").value;

let currentTool = tools.BRUSH;
cursor.style.display = "block";
let lastTool = currentTool;
let currentAction = null;

let startX = 0;
let startY = 0;

const MAX_HISTORY_SIZE = 30;
const CHECKPOINT_INTERVAL = 20;
const MAX_CHECKPOINTS = Math.ceil(MAX_HISTORY_SIZE / CHECKPOINT_INTERVAL);

let commandHistory = [];
let redoStack = [];
let checkpoints = [];

document.getElementById("colorPicker").addEventListener("change", (e) => {
    color = e.target.value;
});

canvas.addEventListener("mousedown", (e) => {
    switch(currentTool){
        case tools.BRUSH:
            currentAction = "draw";
            ctx.beginPath();
            break;
        case tools.ERASER:
            currentAction = "erase";
            ctx.beginPath();
            break;
        case tools.DRAG:
            startX = e.clientX
            startY = e.clientY;
            currentAction = "drag";
            break;
    }
});

canvas.addEventListener("mouseup", () => {

    if(currentAction === "draw" && currentPoints.length > 0) {
        const command = createDrawCommand("draw", currentPoints, brushSize, color);
        saveCommand(command);
        currentPoints = []; // limpa os pontos após salvar o comando
    }
    else if(currentAction === "erase" && currentPoints.length > 0) {
        const command = createDrawCommand("erase", currentPoints, brushSize, "rgba(0, 0, 0, 1)");
        saveCommand(command);
        currentPoints = []; // limpa os pontos após salvar o comando
    }

    currentAction = null;
    ctx.beginPath(); // evita linhas ligadas depois
});

canvas.addEventListener("mousemove", (e) => {

    moveCursor(e);

    currentTool.TOOL(e);
});

window.addEventListener("keydown", (e) => {   // atalhos

    if(e.code === "KeyZ" && e.ctrlKey && !e.shiftKey) { // undo
        e.preventDefault();
        undo();
        return;
    } else if(e.code === "KeyZ" && e.ctrlKey && e.shiftKey) { // redo
        e.preventDefault();
        redo();
        return;
    }

    switch(e.code) {
        case "Space" || "AltLeft": // drag
            e.preventDefault(); // previne o scroll da página
            canvas.style.cursor = "grab";
            if(currentTool !== tools.DRAG) {
                lastTool = currentTool; // salva a ferramenta atual
            }
            toggleDrag();
            break;
        case "KeyV":
            toggleDrag();
            break;
        case "KeyE": // eraser
            toggleEraser();
            break;
        case "KeyB": // brush
            toggleBrush();
            break;
        default:
            // console.log(`Key pressed: ${e.code}`);
            break;
    }
});

window.addEventListener("keyup", (e) => {
    if(e.code === "Space" || e.code === "AltLeft") {
        console.log(lastTool);
        lastTool.TOGGLE(); // volta para a ferramenta anterior
    }
});

function setBrushSize(size) {
    brushSize = size;
    updateCursor(size);
}

function updateCursor(size) {
    cursor.style.width = size + "px";
    cursor.style.height = size + "px";
}

function moveCursor(event) {
    cursor.style.left = event.clientX + "px";
    cursor.style.top = event.clientY + "px";
}

function setColor(newColor) {
    color = newColor;
    document.getElementById("colorPicker").value = newColor;
}

function toggleDrag() {
    currentTool = tools.DRAG;
    canvas.style.cursor = "grab";
    cursor.style.display = "none"; // esconde o cursor personalizado
}

function toggleBrush() {
    currentTool = tools.BRUSH;
    canvas.style.cursor = "none"; // remove o cursor padrão
    cursor.style.display = "block"; // mostra o cursor personalizado
}

function toggleEraser() {
    currentTool = tools.ERASER;
    canvas.style.cursor = "none"; // remove o cursor padrão
    cursor.style.display = "block"; // mostra o cursor personalizado
}

let currentPoints = [];

function draw(event) {
    if (!(currentAction === "draw")) return;

    const rect = canvas.getBoundingClientRect();    // Calcula a posição do mouse relativo ao canvas
    const x = event.pageX - rect.left;
    const y = event.pageY - rect.top;

    const newPoint = { x, y };

    if (currentPoints.length > 0) {
        const lastPoint = currentPoints[currentPoints.length - 1];
        const interpolatedPoints = interpolatePoints(lastPoint, newPoint);
        currentPoints.push(...interpolatedPoints);
    }

    currentPoints.push(newPoint);

    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function createDrawCommand(type, points, size, color) {
    return {
        type,
        points: [...points],
        size,
        color
    };
}

function saveCommand(command) {
    commandHistory.push(command);
    
    if (commandHistory.length > MAX_HISTORY_SIZE) {
        commandHistory.shift(); // remove o comando mais antigo
    }

    if (commandHistory.length % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint();
    }

    redoStack = []; // limpa o redo stack
}

function saveCheckpoint() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    checkpoints.push({
        at: commandHistory.length,
        imageData
    });

    if (checkpoints.length > MAX_CHECKPOINTS) {
        checkpoints.shift(); // remove o checkpoint mais antigo
    }
}

function redrawFromCheckpoint() {
    ctx.clearRect(0, 0, canvas.width, canvasHeight);
    const index = checkpoints.slice().reverse().find(c => c.at <= commandHistory.length);
    const checkpoint = index || checkpoints[0]; // pega o checkpoint mais recente ou o primeiro se não houver
    if (checkpoint) {
        ctx.putImageData(checkpoint.imageData, 0, 0);
    }
    else return;

    const from = checkpoint.at;
    for(let i = from; i < commandHistory.length; i++) {
        applyCommand(commandHistory[i]);
    }
}

function applyCommand(command) {
    if (command.type === "erase") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out"; // modo de apagar
    }

    ctx.lineWidth = command.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = command.color;
    ctx.fillStyle = command.color;

    const points = command.points;

    if (points.length === 1) {
        const p = points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, command.size / 2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    }

    if (command.type === "erase") {
        ctx.restore(); // volta ao modo normal
    }

    ctx.beginPath();
}

function interpolatePoints(p1, p2, maxDistance = 2) {
    const points = [];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);

    if (distance < maxDistance) {
        points.push(p1);
        return points;
    }

    const steps = Math.floor(distance / maxDistance);

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        points.push({
            x: p1.x + t * dx,
            y: p1.y + t * dy
        });
    }
    
    return points;
}

function drag(event) {
    if (!(currentAction === "drag")) return;
    
    const currentX = event.clientX;
    const currentY = event.clientY;

    const dx = currentX - startX;
    const dy = currentY - startY;

    if(dx === 0 && dy === 0) return; // evita scroll desnecessário

    container.scrollBy(-dx, -dy);
    startX = event.clientX;
    startY = event.clientY;
}

function erase(event){
    if (!(currentAction === "erase")) return;

    const rect = canvas.getBoundingClientRect();    // Calcula a posição do mouse relativo ao canvas
    const x = event.pageX - rect.left;
    const y = event.pageY - rect.top;

    ctx.save();
    ctx.globalCompositeOperation = "destination-out"; // modo de apagar

    const newPoint = { x, y };

    if (currentPoints.length > 0) {
        const lastPoint = currentPoints[currentPoints.length - 1];
        const interpolatedPoints = interpolatePoints(lastPoint, newPoint);
        currentPoints.push(...interpolatedPoints);
    }

    currentPoints.push(newPoint);

    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0, 0, 0, 1)"; // cor transparente para apagar

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    ctx.restore();
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    commandHistory = [];
    redoStack = [];
    checkpoints = [];
    saveCheckpoint(); // salva o estado inicial como um checkpoint
}

function undo() {
    if(commandHistory.length === 0) return;

    const lastCommand = commandHistory.pop();
    redoStack.push(lastCommand);

    redrawFromCheckpoint();
}

function redo() {
    if(redoStack.length === 0) return;

    const command = redoStack.pop();
    commandHistory.push(command);

    applyCommand(command);
}

function saveCanvas() {
    const margin = 20;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imgData;

    let top = height, left = width, right = 0, bottom = 0;
    let found = false;

    // Encontra os limites da imagem desenhada
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const alpha = data[index + 3];
            if (alpha !== 0) { // verifica se o pixel é opaco
                found = true;
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }

    if(!found) {
        alert("Não há rabiscos para salvar.");
        return;
    }

    left = Math.max(0, left - margin);
    right = Math.min(width, right + margin);
    top = Math.max(0, top - margin);
    bottom = Math.min(height, bottom + margin);

    const croppedWidth = right - left + 1;
    const croppedHeight = bottom - top + 1;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = croppedWidth;
    tempCanvas.height = croppedHeight;

    const backgroundOption = confirm("Deseja salvar com fundo branco?");
    if (backgroundOption) {
        tempCtx.fillStyle = backgroundColor;
        tempCtx.fillRect(0, 0, croppedWidth, croppedHeight);
        tempCtx.drawImage(canvas, left, top, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
    }
    else{
        const croppedImageData = ctx.getImageData(left, top, croppedWidth, croppedHeight);
        tempCtx.putImageData(croppedImageData, 0, 0);
    }

    const link = document.createElement("a");
    link.download = "meu_rabisco.png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
}