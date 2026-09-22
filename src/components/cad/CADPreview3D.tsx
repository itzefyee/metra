'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { CADModelData, getCADParser } from '@/lib/cad-parser';

interface CADPreview3DProps {
  file?: File;
  modelData?: CADModelData;
  className?: string;
  showStats?: boolean;
  onParsingStart?: () => void;
  onParsingComplete?: (ok: boolean) => void;
  onPreviewLoaded?: (ok: boolean) => void;
  onModelDataParsed?: (data: CADModelData) => void;
}

const CADPreview3D: React.FC<CADPreview3DProps> = ({
  file,
  modelData: initialModelData,
  className = '',
  showStats = true,
  onParsingStart,
  onParsingComplete,
  onPreviewLoaded,
  onModelDataParsed,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [error, setError] = useState<string>('');
  const [modelData, setModelData] = useState<CADModelData | null>(initialModelData || null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Color control states
  const [modelColor, setModelColor] = useState('#777777');
  const [wireframeColor, setWireframeColor] = useState('#000000');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // UI control states
  const [showControls, setShowControls] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const wireframeRef = useRef<THREE.LineSegments | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastParsedFileRef = useRef<File | null>(null);

  // Stable callback refs to prevent re-renders in parent from restarting parse
  const onParsingStartRef = useRef(onParsingStart);
  onParsingStartRef.current = onParsingStart;
  const onParsingCompleteRef = useRef(onParsingComplete);
  onParsingCompleteRef.current = onParsingComplete;
  const onPreviewLoadedRef = useRef(onPreviewLoaded);
  onPreviewLoadedRef.current = onPreviewLoaded;
  const onModelDataParsedRef = useRef(onModelDataParsed);
  onModelDataParsedRef.current = onModelDataParsed;

  // Parse file function
  const parseFile = useCallback(async (fileToParse: File) => {
    setIsLoading(true);
    setLoadingProgress(15);
    setLoadingStage('Reading file data...');
    setError('');

    // Timer to keep progress moving so user never sees a stalled screen
    const progressTimer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev < 40) return prev + 10;
        if (prev < 65) return prev + 5;
        if (prev < 85) return prev + 2;
        return prev;
      });
    }, 300);

    try {
      if (onParsingStartRef.current) onParsingStartRef.current();
      if (onPreviewLoadedRef.current) onPreviewLoadedRef.current(false);
      
      const parser = getCADParser();
      setLoadingStage('Extracting 3D geometry...');
      setLoadingProgress(35);
      
      const data = await parser.parseFile(fileToParse);
      clearInterval(progressTimer);

      setLoadingProgress(85);
      setLoadingStage('Rendering 3D scene...');
      await new Promise(resolve => setTimeout(resolve, 80));
      
      setModelData(data);
      setLoadingProgress(100);
      setLoadingStage('Complete');
      setIsLoading(false);
      
      if (onParsingCompleteRef.current) onParsingCompleteRef.current(true);
      if (onModelDataParsedRef.current) onModelDataParsedRef.current(data);
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error('Error parsing CAD file:', err);
      setError(`Failed to parse file: ${err.message}`);
      setIsLoading(false);
      setLoadingProgress(0);
      if (onParsingCompleteRef.current) onParsingCompleteRef.current(false);
      if (onPreviewLoadedRef.current) onPreviewLoadedRef.current(false);
    }
  }, []);

  // Parse file if provided (strictly guarded so it only executes when file actually changes)
  useEffect(() => {
    if (file && file !== lastParsedFileRef.current && !initialModelData) {
      lastParsedFileRef.current = file;
      parseFile(file);
    } else if (initialModelData && initialModelData !== modelData) {
      setModelData(initialModelData);
      setIsLoading(false);
      if (onParsingCompleteRef.current) onParsingCompleteRef.current(true);
    }
  }, [file, initialModelData, modelData, parseFile]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = canvasContainerRef.current || containerRef.current;
    if (!container || !modelData || isLoading) return;

    // Clear any previous canvas elements to prevent duplicate side-by-side viewports
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    cameraRef.current = camera;

    // Create geometry from model data
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(modelData.vertices, 3));
    
    // Calculate normals
    if (modelData.normals && modelData.normals.length === modelData.vertices.length) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(modelData.normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    
    if (modelData.indices && modelData.indices.length > 0) {
      geometry.setIndex(new THREE.BufferAttribute(modelData.indices, 1));
    }

    // CRITICAL: Center geometry at origin (0, 0, 0) so model is always dead-center
    geometry.center();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const bbox = geometry.boundingBox || new THREE.Box3();
    const dx = bbox.max.x - bbox.min.x;
    const dy = bbox.max.y - bbox.min.y;
    const dz = bbox.max.z - bbox.min.z;
    const maxDim = Math.max(dx, dy, dz, 1);

    // Camera positioning framed neatly on the centered model
    const distance = maxDim * 2.2;
    camera.position.set(distance * 0.9, distance * 0.7, distance * 1.1);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableRotate = true;
    controls.rotateSpeed = 1.0;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.2;
    controls.minDistance = maxDim * 0.2;
    controls.maxDistance = maxDim * 20;
    controls.enablePan = true;
    controls.panSpeed = 1.0;
    controls.screenSpacePanning = true;
    controls.update();
    controlsRef.current = controls;

    // Lighting for crisp industrial CAD appearance
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.45);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(maxDim * 2, maxDim * 3, maxDim * 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-maxDim * 2, -maxDim * 2, -maxDim * 2);
    scene.add(dirLight2);

    // Ground Grid placed right beneath the model's bottom face
    const gridSize = Math.max(maxDim * 3, 20);
    const gridHelper = new THREE.GridHelper(gridSize, 20, 0x94a3b8, 0xe2e8f0);
    gridHelper.position.set(0, bbox.min.y, 0);
    scene.add(gridHelper);

    // Axes helper at bottom-center of the object
    const axesHelper = new THREE.AxesHelper(maxDim * 0.4);
    axesHelper.position.set(0, bbox.min.y, 0);
    scene.add(axesHelper);

    // Material with metallic sheen
    const material = new THREE.MeshStandardMaterial({
      color: parseInt(modelColor.replace('#', '0x')),
      roughness: 0.35,
      metalness: 0.2,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    // Mesh
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    // Wireframe overlay
    const wireframeGeometry = new THREE.EdgesGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ 
      color: parseInt(wireframeColor.replace('#', '0x')),
      linewidth: 1 
    });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    mesh.add(wireframe);
    wireframeRef.current = wireframe;

    // Animation loop
    let isRunning = true;
    const animate = () => {
      if (!isRunning) return;
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Auto-resize with ResizeObserver
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || 800;
      const newHeight = container.clientHeight || 450;
      if (newWidth === 0 || newHeight === 0) return;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      isRunning = false;
      resizeObserver.disconnect();
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      
      geometry.dispose();
      wireframeGeometry.dispose();
      material.dispose();
      wireframeMaterial.dispose();
      renderer.dispose();
      controls.dispose();
      
      while (scene.children.length > 0) { 
        const object = scene.children[0];
        scene.remove(object);
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => mat.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      }
    };
  }, [modelData, isLoading]);

  // Update colors dynamically without reloading scene
  useEffect(() => {
    if (!meshRef.current || !wireframeRef.current) return;

    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    const wireframeMaterial = wireframeRef.current.material as THREE.LineBasicMaterial;

    if (material && material.color) {
      material.color.set(parseInt(modelColor.replace('#', '0x')));
    }
    if (wireframeMaterial && wireframeMaterial.color) {
      wireframeMaterial.color.set(parseInt(wireframeColor.replace('#', '0x')));
    }
  }, [modelColor, wireframeColor]);

  // Handle fullscreen
  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reset view
  const handleResetView = () => {
    if (!cameraRef.current || !controlsRef.current || !meshRef.current) return;
    const geometry = meshRef.current.geometry;
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox || new THREE.Box3();
    const maxDim = Math.max(
      bbox.max.x - bbox.min.x,
      bbox.max.y - bbox.min.y,
      bbox.max.z - bbox.min.z,
      1
    );

    const distance = maxDim * 2.2;
    cameraRef.current.position.set(distance * 0.9, distance * 0.7, distance * 1.1);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // Toggle wireframe
  const handleToggleWireframe = () => {
    if (wireframeRef.current) {
      wireframeRef.current.visible = !wireframeRef.current.visible;
    }
  };

  // Color presets
  const modelPresets = ['#999999', '#777777', '#666666', '#555555', '#444444', '#333333'];
  const wireframePresets = ['#000000', '#222222', '#444444', '#666666', '#888888', '#ffffff'];

  const fileExtension = file?.name.split('.').pop()?.toLowerCase() || 'model';

  useEffect(() => {
    if (!onPreviewLoadedRef.current) return;
    if (isLoading) {
      onPreviewLoadedRef.current(false);
    } else if (error) {
      onPreviewLoadedRef.current(false);
    } else if (modelData) {
      onPreviewLoadedRef.current(true);
    }
  }, [isLoading, error, modelData]);
  // Determine error type and provide specific troubleshooting
  const getErrorDetails = (errorMsg: string) => {
    if (errorMsg.toLowerCase().includes('format') || errorMsg.toLowerCase().includes('parse')) {
      return {
        title: 'File Format Error',
        tips: [
          'Ensure the file is a valid STEP (.step, .stp) format',
          'Try opening the file in CAD software to verify it\'s not corrupted',
          'Check if the file was exported correctly from your CAD program'
        ]
      };
    } else if (errorMsg.toLowerCase().includes('size') || errorMsg.toLowerCase().includes('large')) {
      return {
        title: 'File Size Error',
        tips: [
          'The file may be too large to process in the browser',
          'Try simplifying the model in your CAD software',
          'Consider reducing the number of faces or details'
        ]
      };
    } else if (errorMsg.toLowerCase().includes('memory')) {
      return {
        title: 'Memory Error',
        tips: [
          'Close other browser tabs to free up memory',
          'Try refreshing the page and uploading again',
          'Consider using a simpler model'
        ]
      };
    } else {
      return {
        title: 'Loading Error',
        tips: [
          'Check your internet connection',
          'Try refreshing the page',
          'Ensure the file is not corrupted'
        ]
      };
    }
  };

  const errorDetails = error ? getErrorDetails(error) : null;

  return (
    <div 
      ref={containerRef}
      className={`w-full bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-2 border-gray-200 relative overflow-hidden ${
        isFullscreen 
          ? 'fixed inset-0 z-50 h-screen w-screen rounded-none' 
          : 'h-[350px] md:h-[450px]'
      } ${className}`}
    >
      {/* 3D Canvas Mount Point - Always mounted */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 bg-gray-50/95 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center z-10 max-w-md px-4">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-gray-600 font-medium">Loading 3D model...</p>
            <p className="text-xs text-gray-500 mt-2">{loadingStage}</p>
            
            {/* Progress bar */}
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            
            {/* Progress percentage */}
            <p className="text-xs text-gray-600 mt-2 font-medium">{loadingProgress}%</p>
            
            <p className="text-xs text-gray-400 mt-3">High-precision CAD Renderer</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !isLoading && errorDetails && (
        <div className="absolute inset-0 z-30 bg-gray-50 flex items-center justify-center p-6">
          <div className="text-center p-6 max-w-md">
            {/* Error icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            {/* Error title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{errorDetails.title}</h3>
            
            {/* Error message */}
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            
            {/* Troubleshooting tips */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-yellow-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Troubleshooting Tips:
              </p>
              <ul className="text-xs text-yellow-700 space-y-1">
                {errorDetails.tips.map((tip, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Retry button */}
            {file && (
              <button
                onClick={() => {
                  lastParsedFileRef.current = null;
                  parseFile(file);
                }}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-10">
        <div className="bg-white/95 rounded-lg p-2 shadow-lg">
          <div className="flex flex-col space-y-2">
            <button
              onClick={handleResetView}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Reset view"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={handleToggleWireframe}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Toggle wireframe"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
            
            {/* Color Picker Button */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>
              
              {/* Color Picker Dropdown */}
              {showColorPicker && (
                <div className={`absolute top-0 bg-white rounded-lg shadow-xl border border-gray-200 ${
                  isFullscreen ? 'right-12 w-64' : 'right-12 w-44'
                }`}>
                  <div className={isFullscreen ? 'p-4 space-y-4' : 'p-2 space-y-2'}>
                    {/* Model Color */}
                    <div>
                      <label className={`block font-medium text-gray-700 mb-1.5 ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                        {isFullscreen ? 'Model Color' : 'Model'}
                      </label>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="color"
                          value={modelColor}
                          onChange={(e) => setModelColor(e.target.value)}
                          className={`rounded cursor-pointer flex-shrink-0 ${isFullscreen ? 'w-10 h-10' : 'w-7 h-7'}`}
                        />
                        <input
                          type="text"
                          value={modelColor}
                          onChange={(e) => setModelColor(e.target.value)}
                          className={`flex-1 min-w-0 border border-gray-300 rounded px-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                            isFullscreen ? 'py-1.5 text-sm' : 'py-1 text-xs'
                          }`}
                          placeholder="#777777"
                          maxLength={7}
                        />
                      </div>
                      <div className={`grid grid-cols-6 gap-1 ${isFullscreen ? 'mt-2' : 'mt-1.5'}`}>
                        {modelPresets.map((color) => (
                          <button
                            key={color}
                            onClick={() => setModelColor(color)}
                            className={`rounded border-2 transition-all ${
                              modelColor === color ? 'border-blue-500 scale-110' : 'border-gray-300 hover:border-gray-400'
                            } ${isFullscreen ? 'w-8 h-8' : 'w-5 h-5'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Wireframe Color */}
                    <div>
                      <label className={`block font-medium text-gray-700 mb-1.5 ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                        {isFullscreen ? 'Wireframe Color' : 'Wireframe'}
                      </label>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="color"
                          value={wireframeColor}
                          onChange={(e) => setWireframeColor(e.target.value)}
                          className={`rounded cursor-pointer flex-shrink-0 ${isFullscreen ? 'w-10 h-10' : 'w-7 h-7'}`}
                        />
                        <input
                          type="text"
                          value={wireframeColor}
                          onChange={(e) => setWireframeColor(e.target.value)}
                          className={`flex-1 min-w-0 border border-gray-300 rounded px-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                            isFullscreen ? 'py-1.5 text-sm' : 'py-1 text-xs'
                          }`}
                          placeholder="#000000"
                          maxLength={7}
                        />
                      </div>
                      <div className={`grid grid-cols-6 gap-1 ${isFullscreen ? 'mt-2' : 'mt-1.5'}`}>
                        {wireframePresets.map((color) => (
                          <button
                            key={color}
                            onClick={() => setWireframeColor(color)}
                            className={`rounded border-2 transition-all ${
                              wireframeColor === color ? 'border-blue-500 scale-110' : 'border-gray-300 hover:border-gray-400'
                            } ${isFullscreen ? 'w-8 h-8' : 'w-5 h-5'}`}
                            style={{ 
                              backgroundColor: color,
                              border: color === '#ffffff' ? '2px solid #e5e7eb' : undefined
                            }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleFullscreen}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Format badge */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg uppercase">
          {fileExtension}
        </div>
      </div>

      {/* Instructions - Top Center, Collapsible */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="rounded-lg shadow-lg overflow-hidden bg-white/95">
          <button
            onClick={() => setShowControls(!showControls)}
            className="w-full px-4 py-2 flex items-center justify-center space-x-2 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className={`font-medium text-gray-700 ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
              Controls
            </span>
            <svg 
              className={`w-4 h-4 text-gray-600 transition-transform duration-500 ${showControls ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div 
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ 
              maxHeight: showControls ? '200px' : '0px',
              opacity: showControls ? 1 : 0 
            }}
          >
            <div className={`border-t border-gray-200 ${isFullscreen ? 'p-4' : 'p-3'}`}>
              <div className={`space-y-2 ${isFullscreen ? 'text-sm' : 'text-xs'} text-gray-600`}>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">Rotate:</span>
                  <span>Left click + drag</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">Pan:</span>
                  <span>Right click + drag</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">Zoom:</span>
                  <span>Scroll wheel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Info - Bottom Center, Collapsible */}
      {showStats && modelData && (
        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 ${
          isFullscreen ? 'w-11/12 max-w-6xl' : 'w-11/12 max-w-3xl'
        }`}>
          <div className="bg-white/95 rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={() => setShowModelInfo(!showModelInfo)}
              className="w-full px-4 py-2 flex items-center justify-center space-x-2 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className={`font-medium text-gray-700 ${isFullscreen ? 'text-base' : 'text-sm'}`}>
                Model Info
              </span>
              <svg 
                className={`w-4 h-4 text-gray-600 transition-transform duration-500 ${showModelInfo ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <div 
              className="overflow-hidden transition-all duration-500 ease-in-out"
              style={{ 
                maxHeight: showModelInfo ? '300px' : '0px',
                opacity: showModelInfo ? 1 : 0 
              }}
            >
              <div className="border-t border-gray-200">
                <div className={`${isFullscreen ? 'p-3' : 'p-2'} bg-gray-50 rounded`}>
                  <div className={`grid gap-0 ${
                  isFullscreen 
                    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6' 
                    : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'
                }`}>
                  <div className="text-center p-2">
                    <p className={`text-gray-600 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      Vertices
                    </p>
                    <p className={`font-semibold text-gray-900 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      {modelData.vertices_count.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2">
                    <p className={`text-gray-600 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      Faces
                    </p>
                    <p className={`font-semibold text-gray-900 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      {modelData.faces.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2">
                    <p className={`text-gray-600 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      Edges
                    </p>
                    <p className={`font-semibold text-gray-900 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      {modelData.edges.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2">
                    <p className={`text-gray-600 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      Parts
                    </p>
                    <p className={`font-semibold text-gray-900 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                      {modelData.parts.length}
                    </p>
                  </div>
                  {modelData.volume !== undefined && (
                    <div className="text-center p-2">
                      <p className={`text-gray-600 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                        Volume (mm³)
                      </p>
                      <p className={`font-semibold text-gray-900 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                        {modelData.volume.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {modelData.surfaceArea !== undefined && (
                    <div className="text-center p-2">
                      <p className={`text-gray-600 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                        Surface (mm²)
                      </p>
                      <p className={`font-semibold text-gray-900 truncate ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                        {modelData.surfaceArea.toFixed(2)}
                      </p>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CADPreview3D;
