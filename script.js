var canvas;
var gl;
var program;
var m; // Manager for geometries, textures, uniforms, etc.

var projMatUniform;

var square;
var material;

function start() {
    canvas = document.getElementById('canvas');
    //canvas.addEventListener("click",fullscreen);

    gl = initWebGL2(canvas);

    if(!gl) {

    }

    m = new Manager(gl);

    projMatUniform = new Uniform("projMat", gl.FLOAT, mat4.create());
    window.addEventListener('resize', resize);
    resize();

    program = loadShader(document.getElementById("vertex_shader"),
            document.getElementById("fragment_shader"));

    square = new SceneNode();
    square.drawable = new Geometry();
    square.drawable.count = 4;
    material = new Material(program);
    square.material = material;
    material.uniforms = [projMatUniform];
    
    requestAnimationFrame(draw);
}

function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  m.useMaterial(square.material);
  m.draw(square.drawable);

  //srequestAnimationFrame(draw);
}

function fullscreen(){
    if(canvas.webkitRequestFullScreen) {
        canvas.webkitRequestFullScreen();
    }
    else {
        canvas.mozRequestFullScreen();
    }            
}

function resize(event) {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  
  gl.viewport(0, 0, canvas.width, canvas.height);

  mat4.perspective(projMatUniform.array, 60, canvas.width / canvas.height, .05, 100);

  requestAnimationFrame(draw);
}
