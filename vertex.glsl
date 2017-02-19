#version 300 es

out vec2 screenPos;

void main() {
    int nx = gl_VertexID % 2;
    int ny = (gl_VertexID - nx) / 2;
    screenPos = -1. + 2. * vec2(nx, ny);
    gl_Position = vec4(screenPos, .5, 1.);
}
