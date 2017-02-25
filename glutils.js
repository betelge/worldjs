
// TODO: optimization

var SceneNode = class {
  constructor(geometry, material) {
    // geometry, material are allowed to be left undefined
    this.position = vec3.create();
    this.rotation = quat.create();
    this.scale = vec3.fromValues(1, 1, 1);
    this.children = []; // TODO: implement
    this.parent = undefined;

    this.geometry = geometry;
    this.material = material;

    this.uniforms = []; // These override any material uniforms with the same name
    this.textures = [];

    this.setScale = function(scalar) {
      this.scale[0] = scalar;
      this.scale[1] = scalar;
      this.scale[2] = scalar;
    }
  }
}

var Camera = class extends SceneNode {
  constructor(fov) {
    super();
    this.fov = fov;
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

    // Special tags
    this.mvMatUniform = undefined;
    this.normMatUniform = undefined;
  }
}

var Texture2d = class {
  constructor(name, internalFormat, format, width, height, type, data) {
    this.internalFormat = internalFormat;
    this.format = format;
    this.width = width;
    this.height = height;
    this.type = type;
    this.data = data;

    this.name = name;

    this.glname = -1;
    this.location = -1; // Uniform location
    this.program = -1;
  }
}

var Uniform = class {
  constructor(name, type, values){
    this.name = name;
    this.type = type;

    if(values && !values.length)
      values = [values]; // Allows for scalars

    if(values.length <= 4)
        this.values = values;
    else
        this.array = new Float32Array(values);

    this.location = -1; // Changes for different programs
    this.program = -1; // Last program used
  }
}

var Manager = class {
  constructor(gl, cam) {
    this.gl = gl;
    this.cam = cam;

    this.isLineMode = false;

    this.tempRot = quat.create();
    this.tempPos = vec3.create();
    this.zeroPos = vec3.fromValues(0, 0, 0);
  }

  updateUniform(program, uniform) {

    if(uniform.program !== program) {
      uniform.location = gl.getUniformLocation(program, uniform.name);
      uniform.program = program;
    }

    if(uniform.location == -1)
      return;


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
              break;
            case 2:
              gl.uniform2f(loc, values[0], values[1]);
              break;
            case 3:
              gl.uniform3f(loc, values[0], values[1], values[2]);
              break;
            case 4:
              gl.uniform4f(loc, values[0], values[1], values[2], values[3]);
              break;
          }
          break;
        case gl.INT:
          switch(values.length) {
            case 1:
              gl.uniform1i(loc, values[0]);
              break;
            case 2:
              gl.uniform2i(loc, values[0], values[1]);
              break;
            case 3:
              gl.uniform3i(loc, values[0], values[1], values[2]);
              break;
            case 4:
              gl.uniform4i(loc, values[0], values[1], values[2], values[3]);
              break;
          }
          break;
        case gl.UINT:
          switch(values.length) {
            case 1:
              gl.uniform1ui(loc, values[0]);
              break;
            case 2:
              gl.uniform2ui(loc, values[0], values[1]);
              break;
            case 3:
              gl.uniform3ui(loc, values[0], values[1], values[2]);
              break;
            case 4:
              gl.uniform4ui(loc, values[0], values[1], values[2], values[3]);
              break;
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
  
  bindTexture(program, texture, unit) {
    if(texture.program !== program) {
      texture.location = gl.getUniformLocation(program, texture.name);
      texture.program = program;
    }

    if(texture.location == -1)
      return;

    if(texture.glname == -1)
      this.initTexture(texture);
      
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture.glname);

    gl.uniform1i(texture.location, unit);

  }

  initTexture(texture) {
    gl.activeTexture(gl.TEXTURE0);
    texture.glname = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture.glname);

    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // NEAREST for float
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if(!texture.data) { // Uninitialized
      gl.texImage2D(gl.TEXTURE_2D, 0, texture.internalFormat, texture.width, texture.height, 0, texture.format, texture.type, texture.data);
    }
  }

  useMaterial(mat) {

    gl.useProgram(mat.program);

    for(var i = 0; i < mat.uniforms.length; i++) {
      this.updateUniform(mat.program, mat.uniforms[i]);
    }
    

    for(var i = 0; i < mat.textures.length; i++) {
      this.bindTexture(mat.program, mat.textures[i], i); // Ignored if overridden in SceneNode'
    }
  }

  draw(sceneNode) {

    if(!sceneNode.material.mvMatUniform && sceneNode.material) {
      sceneNode.material.mvMatUniform = new Uniform("mvMat", gl.FLOAT, mat4.create());
      sceneNode.material.uniforms.push(sceneNode.material.mvMatUniform);

      sceneNode.material.normMatUniform = new Uniform("normMat", gl.FLOAT, mat4.create());
      sceneNode.material.uniforms.push(sceneNode.material.normMatUniform);
    }

    if(sceneNode.material) {
      quat.conjugate(this.tempRot, cam.rotation);
      vec3.sub(this.tempPos, sceneNode.position, cam.position);
      vec3.transformQuat(this.tempPos, this.tempPos, this.tempRot);
      quat.mul(this.tempRot, sceneNode.rotation, this.tempRot);

      mat4.fromRotationTranslationScale(
          sceneNode.material.mvMatUniform.array, this.tempRot, this.tempPos, sceneNode.scale);

      mat4.fromRotationTranslationScale(
          sceneNode.material.normMatUniform.array, sceneNode.rotation, this.zeroPos, sceneNode.scale)
      
      this.useMaterial(sceneNode.material);

      for(var i = 0; i < sceneNode.uniforms.length; i++) {
        this.updateUniform(sceneNode.material.program, sceneNode.uniforms[i]);
      }

      for(var i = 0; i < sceneNode.textures.length; i++) {
        this.bindTexture(sceneNode.material.program, sceneNode.textures[i], i);
      }
    }

    var mode = gl.TRIANGLE_STRIP;
    if(this.isLineMode)
      mode = gl.LINE_STRIP;

    if(!sceneNode.geometry.vertices)
      gl.drawArrays(mode, 0, sceneNode.geometry.count);
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
  if(!shaderScript.length) {// Not an array of shaders to merge
    shaderScript = [shaderScript];
  }

  var source = "";
  for(var i = 0; i < shaderScript.length; i++) {
    var currentChild = shaderScript[i].firstChild;

    while(currentChild) {
      if (currentChild.nodeType == 3) {
        source += currentChild.textContent;
      }

      currentChild = currentChild.nextSibling;
    }

    source += "\n";
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

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      console.log(message);

    return program;
}