var SceneNode = class {
  constructor() {
    this.position = vec3.create();
    this.rotation = quat.create();
    this.children = []; // TODO: implement
    this.parent = undefined;

    this.geometry = undefined;
    this.material = undefined;
  }
}

var Geometry = class {
  constructor(vertices, indices) {
    this.vertices = vertices;
    this.indices = indices;

    // Available if uploaded
    this.vba = undefined;
    this.offset = undefined;
    this.count = undefined;
  }
}

var Material = class {
  constructor(program) {
    this.program = program;
    this.textures = [];
    this.uniforms = [];
  }
}

var Texture2d = class {
  constructor(internalFormat, format, width, height, type, data) {
    this.internalFormat = internalFormat;
    this.format = format;
    this.width = width;
    this.height = height;
    this.data = data;
  }
}

var Uniform = class {
  constructor(name, type, values){
    this.name = name;
    this.type = type;

    if(values.length <= 4)
        this.values = values;
    else
        this.array = new Float32Array(values);

    this.location = -1; // Changes for different programs
  }
}

var Manager = class {
  constructor(gl) {
    this.gl = gl;
  }

  updateUniform(program, uniform) {

    //if(uniform.location == -2)
    //  return;

    //if(uniform.location == -1) {
      uniform.location = gl.getUniformLocation(program, uniform.name);

    //  if(uniform.location == -1) {
    //    uniform.location = -2;
    //    return;
    //  }
    //}

    var type = uniform.type;
    var loc = uniform.location;
    var values = uniform.values;

    if(typeof values !== 'undefined') {
      // Scalar or vector
      switch(type){
        case gl.FLOAT:
          switch(values.length) {
            case 1:
              gl.uniform1f(loc, values[0]);
            case 2:
              gl.uniform2f(loc, values[0], values[1]);
            case 3:
              gl.uniform3f(loc, values[0], values[1], values[2]);
            case 4:
              gl.uniform4f(loc, values[0], values[1], values[2], values[3]);
          }
          break;
        case gl.INT:
          switch(values.length) {
            case 1:
              gl.uniform1i(loc, values[0]);
            case 2:
              gl.uniform2i(loc, values[0], values[1]);
            case 3:
              gl.uniform3i(loc, values[0], values[1], values[2]);
            case 4:
              gl.uniform4i(loc, values[0], values[1], values[2], values[3]);
          }
          break;
        case gl.UINT:
          switch(values.length) {
            case 1:
              gl.uniform1ui(loc, values[0]);
            case 2:
              gl.uniform2ui(loc, values[0], values[1]);
            case 3:
              gl.uniform3ui(loc, values[0], values[1], values[2]);
            case 4:
              gl.uniform4ui(loc, values[0], values[1], values[2], values[3]);
          }
          break;

      }
    }
    else {
      // Matrix
      switch(type) {
        case gl.FLOAT:
          switch(uniform.array.length) {
            case 16:
              gl.uniformMatrix4fv(loc, false, uniform.array);
              break;
            case 9:
              gl.uniformMatrix3fv(loc, false, uniform.array);
              break;
            case 4:
              gl.uniformMatrix2fv(loc, false, uniform.array);
              break;
          }
          break;
      }
    }
  }


  useMaterial(mat) {

    gl.useProgram(mat.program);

    for(var i = 0; i < mat.uniforms.length; i++) {
      this.updateUniform(mat.program, mat.uniforms[i]);
    }
    

    // TODO: textures
  }

  draw(drawable) {

    if(!drawable.vertices)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, drawable.count);
  }
}

function initWebGL2(canvas) {
  return initWebGL(canvas, "webgl2");
}

function initWebGL1(canvas) {
  return initWebGL(canvas, "experminetal-webgl");
}

function initWebGL(canvas, version) {
  var gl = null;

  try {
    gl = canvas.getContext(version);
  }
  catch(e) {
    return false;
  }

  return gl;
}

function retrieveInnerText(shaderScript) {
  var source = "";
  var currentChild = shaderScript.firstChild;
  
  while(currentChild) {
    if (currentChild.nodeType == 3) {
      source += currentChild.textContent;
    }
    
    currentChild = currentChild.nextSibling;
  }

  return source;
}

function loadShader(vertexScript, fragmentScript, message) {
    var vertexSource = retrieveInnerText(vertexScript);
    var fragmentSource = retrieveInnerText(fragmentScript);

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexSource);
    gl.shaderSource(fragmentShader, fragmentSource);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    var program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    message = "Vertex shader info log:\n"
        + gl.getShaderInfoLog(vertexShader)
        + "\n\n"
        + "Fragment shader info log:\n"
        + gl.getShaderInfoLog(fragmentShader)
        + "\n\n"
        + "Shader program info log:\n"
        + gl.getProgramInfoLog(program);

    return program;
}