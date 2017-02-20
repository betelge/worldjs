var canvas;
var gl;
var program;
var m; // Manager for geometries, textures, uniforms, etc.

var projMatUniform;

var square;

function start() {
    canvas = document.getElementById('canvas');
    canvas.addEventListener("click", onClick);

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
    square.geometry = new Geometry();
    square.geometry.count = 4;
    material = new Material(program);
    square.material = material;
    material.uniforms = [projMatUniform];
    
    redraw();
}

function redraw() {
  requestAnimationFrame(draw);
}

function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  m.draw(square);

  //srequestAnimationFrame(draw);
}

function onClick(event) {
  var x = 2 * event.clientX/canvas.width - 1;
  var y = 2 * event.clientY/canvas.height - 1;
  vec3.set(square.position, -x, y, 0);

  redraw();
}

function fullscreen() {
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

  redraw();
}
