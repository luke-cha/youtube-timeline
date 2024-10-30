import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Define YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface TimelineData {
  query: string;
  startTime: number;
  endTime: number;
  timestamp: string;
}

const YouTubeTimelineMarker = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [currentRange, setCurrentRange] = useState([0, 100]);
  const [query, setQuery] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoTitle, setVideoTitle] = useState('');
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [isAPIReady, setIsAPIReady] = useState(false);
  
  useEffect(() => {
    // Initialize YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Setup player when API is ready
    window.onYouTubeIframeAPIReady = () => {
      setIsAPIReady(true);
      if (videoId) {
        initializePlayer();
      }
    };

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Add new useEffect to watch videoId changes
  useEffect(() => {
    if (isAPIReady && videoId) {
      initializePlayer();
    }
  }, [videoId, isAPIReady]);

  const initializePlayer = () => {
    if (!videoId) return;
    
    playerRef.current = new YT.Player('youtube-player', {
      videoId: videoId,
      height: '100%',
      width: '100%',
      events: {
        onReady: (event) => {
          const duration = event.target.getDuration();
          const player = event.target as any;
          setVideoTitle(player.getVideoData().title);
          setVideoDuration(duration);
          setCurrentRange([0, duration]);

          // Log video information
          console.group('YouTube Video Information');
          console.log('Video Data:', player.getVideoData());
          console.log('Player State:', player.getPlayerState());
          console.log('Available Quality Levels:', player.getAvailableQualityLevels());
          console.log('Current Time:', player.getCurrentTime());
          console.log('Duration:', player.getDuration());
          console.log('Video URL:', player.getVideoUrl());
          console.log('Video Embed Code:', player.getVideoEmbedCode());
          console.log('Video Loading Progress:', player.getVideoLoadedFraction());
          console.log('Playback Quality:', player.getPlaybackQuality());
          console.log('Playback Rate:', player.getPlaybackRate());
          
          try {
            // These might not be available for all videos
            console.log('Video Statistics:', player.getVideoStats());
            console.log('Playlist:', player.getPlaylist());
            console.log('Playlist Index:', player.getPlaylistIndex());
          } catch (error) {
            console.log('Additional data not available');
          }
          console.groupEnd();
        },
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.PLAYING) {
            startTimeUpdate();
          } else if (event.data === YT.PlayerState.PAUSED) {
            stopTimeUpdate();
            const currentTime = event.target.getCurrentTime();
            setCurrentRange(prev => [currentTime, prev[1]]);
          }
        }
      }
    });
  };

  const startTimeUpdate = () => {
    stopTimeUpdate(); // Clear existing interval
    
    intervalRef.current = window.setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        setCurrentRange(prev => [currentTime, prev[1]]);
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
    const extractedId = extractVideoId(videoUrl);
    if (extractedId) {
      setVideoId(extractedId);
    } else {
      alert('Please enter a valid YouTube URL.');
    }
  };

  const handleAddTimelineData = () => {
    if (query.trim() === '') {
      alert('Please enter a search term.');
      return;
    }

    const newData = {
      query,
      startTime: currentRange[0],
      endTime: currentRange[1],
      timestamp: new Date().toISOString()
    };

    setTimelineData([...timelineData, newData]);
    setQuery('');
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSliderChange = (newRange: number[]) => {
    // Update both values from the slider
    setCurrentRange(newRange);
    
    // Only seek video if start time changed
    if (newRange[0] !== currentRange[0] && playerRef.current) {
      playerRef.current.seekTo(newRange[0], true);
    }
  };

  const handleExport = () => {
    const exportData = {
      videoUrl,
      title: videoTitle,
      duration: videoDuration,
      timelineData
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
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleUrlSubmit}>Load Video</Button>
        </div>

        {videoId && (
          <div className="aspect-video w-full">
            <div id="youtube-player"></div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Time Range: {formatTime(currentRange[0])} - {formatTime(currentRange[1])}
          </p>
          <Slider
            value={currentRange}
            min={0}
            max={videoDuration}
            step={1}
            className="w-full [&>.relative>.absolute]:bg-blue-500 [&_[role=slider]]:block [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:rounded-full [&_[role=slider]]:border [&_[role=slider]]:border-primary/50 [&_[role=slider]]:bg-background [&_[role=slider]]:shadow [&_[role=slider]]:transition-colors [&_[role=slider]]:focus-visible:outline-none [&_[role=slider]]:focus-visible:ring-1 [&_[role=slider]]:focus-visible:ring-ring [&_[role=slider]]:disabled:pointer-events-none [&_[role=slider]]:disabled:opacity-50"
            onValueChange={handleSliderChange}
          />
        </div>

        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="Enter search term"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAddTimelineData}>Add Timeline</Button>
          <Button onClick={handleExport} variant="outline">Export JSON</Button>
        </div>

        <div className="space-y-2">
          {timelineData.map((data, index) => (
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