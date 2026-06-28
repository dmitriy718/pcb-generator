import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TriangleMesh } from '../../../shared/domain';

export function PreviewViewport({ mesh }: { mesh: TriangleMesh | undefined }): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const currentHost = host;

    const scene = new Scene();
    sceneRef.current = scene;
    scene.background = new Color('#eef1f0');
    const camera = new PerspectiveCamera(45, currentHost.clientWidth / currentHost.clientHeight, 0.1, 2000);
    camera.position.set(90, -110, 80);
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(currentHost.clientWidth, currentHost.clientHeight);
    currentHost.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 15);

    const ambient = new AmbientLight('#ffffff', 1.7);
    const key = new DirectionalLight('#ffffff', 2.5);
    key.position.set(80, -120, 140);
    scene.add(ambient, key, new GridHelper(180, 18, '#9aa4a6', '#d3d8d7'));

    let frame = 0;
    function render(): void {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    }
    render();

    function resize(): void {
      const width = currentHost.clientWidth;
      const height = currentHost.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(currentHost);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      const material = meshRef.current.material;
      if (Array.isArray(material)) {
        for (const current of material) {
          current.dispose();
        }
      } else {
        material.dispose();
      }
      meshRef.current = null;
    }

    if (!mesh) {
      return;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.vertices), 3));
    geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.indices), 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const material = new MeshPhongMaterial({
      color: '#c7d6d3',
      shininess: 35,
      transparent: true,
      opacity: 0.94,
    });
    const renderedMesh = new Mesh(geometry, material);
    scene.add(renderedMesh);
    meshRef.current = renderedMesh;
  }, [mesh]);

  return <div className="three-host" ref={hostRef} />;
}
