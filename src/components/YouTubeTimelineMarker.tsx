import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ReactSlider from 'react-slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Mic, Square } from 'lucide-react';

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface TimelineData {
  query: string;
  startTime: number;
  endTime: number;
  timestamp: string;
}

interface YouTubePlayerState {
  videoUrl: string;
  videoId: string;
  timelineData: TimelineData[];
  currentRange: [number, number];
  query: string;
  videoDuration: number;
  videoTitle: string;
  currentTime: number;
  isAPIReady: boolean;
  isRecording: boolean;
}

const YouTubeTimelineMarker = () => {
  const [state, setState] = useState<YouTubePlayerState>({
    videoUrl: '',
    videoId: '',
    timelineData: [],
    currentRange: [0, 100],
    query: '',
    videoDuration: 0,
    videoTitle: '',
    currentTime: 0,
    isAPIReady: false,
    isRecording: false
  });

  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    initYouTubeAPI();
    return cleanupInterval;
  }, []);

  useEffect(() => {
    if (state.isAPIReady && state.videoId) {
      initializePlayer();
    }
  }, [state.videoId, state.isAPIReady]);

  const initYouTubeAPI = () => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setState(prev => ({ ...prev, isAPIReady: true }));
    };
  };

  const cleanupInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const initializePlayer = () => {
    if (!state.videoId) return;
    
    playerRef.current = new YT.Player('youtube-player', {
      videoId: state.videoId,
      height: '100%',
      width: '100%',
      events: {
        onReady: handlePlayerReady,
        onStateChange: handlePlayerStateChange
      }
    });
  };

  const handlePlayerReady = (event: any) => {
    const duration = event.target.getDuration();
    const player = event.target as any;
    setState(prev => ({
      ...prev,
      videoTitle: player.getVideoData().title,
      videoDuration: duration,
      currentRange: [0, duration],
      currentTime: 0
    }));
  };

  const handlePlayerStateChange = (event: any) => {
    if (event.data === YT.PlayerState.PLAYING) {
      startTimeUpdate();
    } else if (event.data === YT.PlayerState.PAUSED) {
      stopTimeUpdate();
      setState(prev => ({ ...prev, currentTime: event.target.getCurrentTime() }));
    }
  };

  const startTimeUpdate = () => {
    stopTimeUpdate();
    
    intervalRef.current = window.setInterval(() => {
      if (playerRef.current) {
        const time = playerRef.current.getCurrentTime();
        setState(prev => ({ ...prev, currentTime: time }));
      }
    }, 100);
  };

  const stopTimeUpdate = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleUrlSubmit = () => {
    const extractedId = extractVideoId(state.videoUrl);
    if (extractedId) {
      setState(prev => ({ ...prev, videoId: extractedId }));
    } else {
      alert('Please enter a valid YouTube URL.');
    }
  };

  const handleAddTimelineData = () => {
    if (state.query.trim() === '') {
      alert('Please enter a search term.');
      return;
    }

    const newData = {
      query: state.query,
      startTime: state.currentRange[0],
      endTime: state.currentRange[1],
      timestamp: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      timelineData: [...prev.timelineData, newData],
      query: ''
    }));
  };

  const handleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      console.log('onresult', event);
      const transcript = event.results[0][0].transcript;
      console.log(transcript);
      setState(prev => ({ ...prev, query: transcript }));
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended.');
      setState(prev => ({ ...prev, isRecording: false }));
    };

    if (!state.isRecording) {
      recognition.start();
      setState(prev => ({ ...prev, isRecording: true }));
    } else {
      recognition.stop();
      setState(prev => ({ ...prev, isRecording: false }));
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleExport = () => {
    const exportData = {
      videoUrl: state.videoUrl,
      title: state.videoTitle,
      duration: state.videoDuration,
      timelineData: state.timelineData
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube-timeline.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTimelineMarkerDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * state.videoDuration;
      setState(prev => ({ ...prev, currentTime: newTime }));
      if (playerRef.current) {
        playerRef.current.seekTo(newTime, true);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>YouTube Timeline Marker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="Enter YouTube URL"
            value={state.videoUrl}
            onChange={(e) => setState(prev => ({ ...prev, videoUrl: e.target.value }))}
            className="flex-1"
          />
          <Button onClick={handleUrlSubmit}>Load Video</Button>
        </div>

        {state.videoId && (
          <div className="aspect-video w-full">
            <div id="youtube-player"></div>
          </div>
        )}
        <div className="flex justify-end text-sm font-medium">
          <span>{formatTime(state.videoDuration)}</span>
        </div>

        <div className="relative h-4 mb-8">
          <ReactSlider
            className="timeline-bar absolute -translate-y-1/2 w-[102.3%]" 
            thumbClassName="thumb"
            trackClassName="track"
            value={[state.currentRange[0], state.currentRange[1]]}
            min={0}
            max={state.videoDuration}
            step={1}
            onChange={(values: number[]) => {
              setState(prev => ({ ...prev, currentRange: values as [number, number] }));
            }}
            renderThumb={(props, sliderState) => {
              const { key, ...restProps } = props;
              return (
                <div 
                  key={sliderState.index}
                  {...restProps}
                  className="flex items-center cursor-grab"
                >
                  {sliderState.index === 0 ? (
                    <ChevronLeft className="w-10 h-10 text-blue-600 -translate-y-[12px] -translate-x-3" />
                  ) : (
                    <ChevronRight className="w-10 h-10 text-blue-600 -translate-y-[12px] -translate-x-3" />
                  )}
                  <div className="absolute -bottom-4 text-xs -translate-y-[12px]">
                    {formatTime(state.currentRange[sliderState.index])}
                  </div>
                </div>
              );
            }}
          />
          <div
            className="absolute top-1/2 w-full h-[1px] bg-gray-600 flex justify-between"
            style={{
              transform: 'translateY(-50%)',
              zIndex: 10
            }}
          >
            <div className="w-[1px] h-4 bg-gray-600 -translate-y-[7px]" />
            <div className="w-[1px] h-4 bg-gray-600 -translate-y-[7px]" />
          </div>
          <div className="absolute flex flex-col items-center cursor-pointer"
            style={{ 
              left: `${(state.currentTime / state.videoDuration) * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 20
            }}
            onMouseDown={handleTimelineMarkerDrag}
          >
            <div className="text-xs -translate-y-[7px]">{formatTime(state.currentTime)}</div>
            <div className="w-4 h-4 bg-red-600 rounded-full translate-y-[0.5px]" />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button onClick={handleSpeechRecognition}>
            {state.isRecording ? (
              <Square className="w-4 h-4 text-red-500" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
          <Input
            type="text"
            placeholder="Enter search term"
            value={state.query}
            onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
            className="flex-1"
          />
          <Button onClick={handleAddTimelineData}>Add Timeline</Button>
          <Button onClick={handleExport} variant="outline">Export JSON</Button>
        </div>

        <div className="space-y-2">
          {state.timelineData.map((data, index) => (
            <Alert key={index}>
              <AlertDescription>
                Query: {data.query}
                <br />
                Time Range: {formatTime(data.startTime)} - {formatTime(data.endTime)}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default YouTubeTimelineMarker;