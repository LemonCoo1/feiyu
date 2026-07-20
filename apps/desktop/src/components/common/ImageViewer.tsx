import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize } from "lucide-react";

interface ImageViewerProps {
  url: string;
  alt?: string;
  onClose: () => void;
}

export function ImageViewer({ url, alt, onClose }: ImageViewerProps) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState(0);
  const [initialScale, setInitialScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 重置变换
  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 缩放控制
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.2, 0.1));
  }, []);

  const handleZoomTo = useCallback((newScale: number) => {
    setScale(Math.max(0.1, Math.min(5, newScale)));
  }, []);

  // 旋转控制
  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  // 下载图片
  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = url;
    link.download = alt || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [url, alt]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomIn();
          }
          break;
        case "-":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomOut();
          }
          break;
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetTransform();
          }
          break;
        case "r":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRotate();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleZoomIn, handleZoomOut, resetTransform, handleRotate]);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(5, prev * delta)));
  }, []);

  // 鼠标拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  // 鼠标拖拽中
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  // 鼠标拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 触摸事件处理（支持双指缩放）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // 单指拖拽
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      // 双指缩放
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setInitialDistance(distance);
      setInitialScale(scale);
    }
  }, [position, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      // 单指拖拽
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && initialDistance > 0) {
      // 双指缩放
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const newScale = initialScale * (distance / initialDistance);
      setScale(Math.max(0.1, Math.min(5, newScale)));
    }
  }, [isDragging, dragStart, initialDistance, initialScale]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setInitialDistance(0);
  }, []);

  // 双击还原/放大
  const handleDoubleClick = useCallback(() => {
    if (scale === 1) {
      setScale(2);
    } else {
      resetTransform();
    }
  }, [scale, resetTransform]);

  // 点击背景关闭
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* 图片 */}
      <img
        ref={imageRef}
        src={url}
        alt={alt || "Image"}
        className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
          transition: isDragging ? "none" : "transform 0.2s ease",
        }}
        draggable={false}
      />

      {/* 工具栏 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-feiyu-overlay-heavy rounded-feiyu-xl p-2 backdrop-blur-md">
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-feiyu-lg transition-colors"
          title={t("imageViewer.zoomOut")}
        >
          <ZoomOut size={20} />
        </button>
        
        <div className="px-3 py-1 text-white text-sm min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </div>
        
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-feiyu-lg transition-colors"
          title={t("imageViewer.zoomIn")}
        >
          <ZoomIn size={20} />
        </button>
        
        <div className="w-px h-6 bg-white/30" />
        
        <button
          onClick={() => handleZoomTo(1)}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-feiyu-lg transition-colors"
          title={t("imageViewer.reset")}
        >
          <Maximize size={20} />
        </button>
        
        <button
          onClick={handleRotate}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-feiyu-lg transition-colors"
          title={t("imageViewer.rotate")}
        >
          <RotateCw size={20} />
        </button>
        
        <div className="w-px h-6 bg-white/30" />
        
        <button
          onClick={handleDownload}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-feiyu-lg transition-colors"
          title={t("imageViewer.download")}
        >
          <Download size={20} />
        </button>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-feiyu-lg transition-colors"
        title={t("imageViewer.close")}
      >
        <X size={24} />
      </button>
    </div>
  );
}