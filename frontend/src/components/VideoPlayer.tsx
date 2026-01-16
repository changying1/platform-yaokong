import React, { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  onError?: (error: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  const initPlayer = () => {
    try {
      if (!videoRef.current) return;

      const flvjs = (window as any).flvjs;
      
      if (!flvjs) {
        console.warn('flv.js not loaded yet, using native video player');
        if (videoRef.current && src) {
          videoRef.current.src = src;
          videoRef.current.play().catch(() => {
            console.warn('Autoplay blocked by browser policy');
          });
        }
        return;
      }

      // Ensure FLV URL
      let flvUrl = src;
      if (src && src.includes('.m3u8')) {
        flvUrl = src.replace('/index.m3u8', '.flv');
      }

      if (!flvUrl) {
        console.warn('No stream URL provided');
        setConnectionStatus('error');
        return;
      }

      if (flvjs.isSupported && flvjs.isSupported()) {
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (e) {
            console.warn('Error destroying previous player:', e);
          }
        }

        try {
          playerRef.current = flvjs.createPlayer({
            type: 'flv',
            url: flvUrl,
            isLive: true,
            hasAudio: false,  // G711U audio codec not supported by flv.js
            hasVideo: true,
            deferredLoadThreshold: 0,
            bufferingDuration: 0.5,
            bufferingTimeout: 3000,
            stashInitialSize: 128 * 1024,
            autoplay: true
          });

          if (playerRef.current && videoRef.current) {
            playerRef.current.attachMediaElement(videoRef.current);
            playerRef.current.load();
            
            // Add event listeners
            playerRef.current.on('error', (type: string, detail: any, msg: string) => {
              console.error('FLV player error:', type, detail, msg);
              setConnectionStatus('error');
              
              // Retry on errors
              if (retryCountRef.current < maxRetries) {
                console.log(`Retrying stream... (attempt ${retryCountRef.current + 1}/${maxRetries})`);
                retryCountRef.current++;
                setTimeout(() => {
                  initPlayer();
                }, retryDelay);
              } else {
                const errorMsg = `Failed to load stream after ${maxRetries} retries. Stream may not be available yet.`;
                console.error(errorMsg);
                onError?.(errorMsg);
              }
            });

            playerRef.current.on('statistics_info', (stats: any) => {
              setConnectionStatus('connected');
              retryCountRef.current = 0; // Reset retry count on successful connection
              console.log('Stream stats:', stats);
            });

            playerRef.current.play().catch((e: any) => {
              console.warn('Auto-play failed:', e);
            });
          }
        } catch (e) {
          console.error('Failed to create FLV player:', e);
          setConnectionStatus('error');
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            setTimeout(() => {
              initPlayer();
            }, retryDelay);
          } else {
            onError?.(`Failed to create player: ${e}`);
          }
        }
      } else {
        console.warn('FLV is not supported, falling back to native player');
        if (videoRef.current) {
          videoRef.current.src = flvUrl;
          videoRef.current.play().catch(() => {
            console.warn('Autoplay blocked');
          });
        }
      }
    } catch (e) {
      console.error('Unexpected error initializing player:', e);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    if (!src) return;
    
    retryCountRef.current = 0; // Reset retry count when src changes
    initPlayer();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {
          console.warn('Error cleaning up player:', e);
        }
      }
    };
  }, [src]);

  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden relative">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
      />
      
      {/* Connection status indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/60 px-3 py-1 rounded text-xs">
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-500' :
          connectionStatus === 'connecting' ? 'bg-yellow-500' :
          'bg-red-500'
        }`} />
        <span className="text-white">
          {connectionStatus === 'connected' ? 'Live' :
           connectionStatus === 'connecting' ? 'Connecting...' :
           'Error'}
        </span>
      </div>
    </div>
  );
};

export default VideoPlayer;
