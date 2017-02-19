var canvas;
var gl;
var program;

function start() {
    canvas = document.getElementById('canvas');
    //canvas.addEventListener("click",fullscreen);

    gl = initWebGL2(canvas);


    window.addEventListener('resize', resize);

    program = loadShader(document.getElementById("vertex_shader"),
            document.getElementById("fragment_shader"));
    
    resize();
    requestAnimationFrame(draw);
}

function draw() {
  gl.useProgram(program);

  gl.clearColor(0, 0, 0, 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

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

  requestAnimationFrame(draw);
}
