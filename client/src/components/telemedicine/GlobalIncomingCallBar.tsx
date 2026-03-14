import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useIncomingCall } from '@/hooks/use-incoming-call';
import { IncomingCallModal, type IncomingCallData } from '@/components/telemedicine/incoming-call-modal';
import { LiveKitVideoCall } from '@/components/telemedicine/livekit-video-call';
import { LiveKitAudioCall } from '@/components/telemedicine/livekit-audio-call';
import { socketManager, buildSocketUserIdentifier } from '@/lib/socket-manager';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const RINGTONE_URL = '/incoming-call-ringtone.mp3';

// Global ringtone controller attached to window for guaranteed cleanup
declare global {
  interface Window {
    __incomingCallRingtone?: HTMLAudioElement | null;
    __stopIncomingCallRingtone?: () => void;
  }
}

// Global function to stop ringtone - can be called from anywhere
const globalStopRingtone = () => {
  console.log('[GlobalRingtone] Stopping all ringtones...');
  
  // Stop any audio with the ringtone src
  const allAudioElements = document.querySelectorAll('audio');
  allAudioElements.forEach((audio) => {
    if (audio.src.includes('incoming-call-ringtone') || audio.src.includes('ringtone')) {
      try {
        audio.muted = true;
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
        console.log('[GlobalRingtone] Stopped audio element');
      } catch (e) {
        console.log('[GlobalRingtone] Error stopping audio:', e);
      }
    }
  });
  
  // Also stop the window-level ringtone
  if (window.__incomingCallRingtone) {
    try {
      const audio = window.__incomingCallRingtone;
      audio.muted = true;
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audio.load();
      window.__incomingCallRingtone = null;
      console.log('[GlobalRingtone] Stopped window-level ringtone');
    } catch (e) {
      console.log('[GlobalRingtone] Error stopping window ringtone:', e);
    }
  }
};

// Attach to window for global access
if (typeof window !== 'undefined') {
  window.__stopIncomingCallRingtone = globalStopRingtone;
}

// Stop camera (video tracks) when closing Incoming Video Call
function stopCameraForIncomingVideoCall() {
  try {
    document.querySelectorAll('video').forEach((videoEl) => {
      const video = videoEl as HTMLVideoElement;
      if (video.srcObject instanceof MediaStream) {
        const stream = video.srcObject as MediaStream;
        stream.getVideoTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    });
  } catch (e) {
    console.log('[GlobalIncomingCall] Error stopping camera:', e);
  }
}

export function GlobalIncomingCallBar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { incomingCall, acceptCall, declineCall, clearIncomingCall } = useIncomingCall();
  
  const [activeVideoCall, setActiveVideoCall] = useState<{
    roomName: string;
    token: string;
    serverUrl: string;
    callerName: string;
    callerId: string;
  } | null>(null);
  
  const [activeAudioCall, setActiveAudioCall] = useState<{
    roomName: string;
    token: string;
    serverUrl: string;
    callerName: string;
    callerId: string;
  } | null>(null);

  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppedRef = useRef(false);

  const stopRingtone = useCallback(() => {
    console.log('[GlobalIncomingCall] stopRingtone called');
    isStoppedRef.current = true;
    globalStopRingtone();
  }, []);

  const playRingtone = useCallback(() => {
    // First stop any existing ringtone
    globalStopRingtone();
    
    // Reset stopped flag
    isStoppedRef.current = false;
    
    console.log('[GlobalIncomingCall] Starting ringtone...');
    
    const audio = new Audio(RINGTONE_URL);
    audio.loop = true;
    audio.volume = 1.0;
    
    // Store in window for global access
    window.__incomingCallRingtone = audio;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Check if we were stopped while play() was pending
          if (isStoppedRef.current) {
            console.log('[GlobalIncomingCall] Was stopped during play(), cleaning up');
            globalStopRingtone();
          } else {
            console.log('[GlobalIncomingCall] Ringtone playing successfully');
          }
        })
        .catch((error) => {
          console.log('[GlobalIncomingCall] Autoplay blocked:', error.message);
        });
    }
  }, []);

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  }, []);

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (incomingCall) {
      console.log('[GlobalIncomingCall] Incoming call detected:', incomingCall);
      console.log('[GlobalIncomingCall] Call from:', incomingCall.fromUsername || incomingCall.fromUserId);
      console.log('[GlobalIncomingCall] Token exists:', !!incomingCall.token);
      console.log('[GlobalIncomingCall] isVideo:', incomingCall.isVideo);
      playRingtone();
    } else {
      console.log('[GlobalIncomingCall] No incoming call, stopping ringtone');
      stopRingtone();
    }
  }, [incomingCall, playRingtone, stopRingtone]);

  useEffect(() => {
    return () => {
      stopRingtone();
      stopCallTimer();
    };
  }, [stopRingtone, stopCallTimer]);

  useEffect(() => {
    const closeIncomingCallIfMatch = (data: { roomId?: string }) => {
      if (!incomingCall || !data.roomId) return;
      
      // More tolerant room ID matching - handles cases where room IDs might differ slightly
      const roomIdMatches = 
        data.roomId === incomingCall.roomId ||
        (data.roomId.includes && data.roomId.includes(incomingCall.roomId)) ||
        (incomingCall.roomId.includes && incomingCall.roomId.includes(data.roomId));
      
      if (roomIdMatches) {
        console.log('[GlobalIncomingCall] Auto-decline and close Incoming Audio/Video Call - caller ended or declined', {
          dataRoomId: data.roomId,
          incomingCallRoomId: incomingCall.roomId,
        });
        if (incomingCall.isVideo) stopCameraForIncomingVideoCall();
        stopRingtone();
        clearIncomingCall();
      }
    };

    const unsubscribeCallEnded = socketManager.on('call_ended', (data: any) => {
      console.log('[GlobalIncomingCall] Received call_ended event:', data);
      
      // If we have an incoming call for this room (caller cancelled from "Call in Progress"), close popup
      closeIncomingCallIfMatch(data);
      
      // More tolerant room ID matching for active calls
      const videoCallMatches = activeVideoCall && data.roomId && (
        data.roomId === activeVideoCall.roomName ||
        (data.roomId.includes && data.roomId.includes(activeVideoCall.roomName)) ||
        (activeVideoCall.roomName.includes && activeVideoCall.roomName.includes(data.roomId))
      );
      
      if (videoCallMatches) {
        console.log('[GlobalIncomingCall] Closing video call - caller ended');
        stopCallTimer();
        setActiveVideoCall(null);
        toast({
          title: "Call Ended",
          description: "The other participant ended the call",
        });
      }
      
      const audioCallMatches = activeAudioCall && data.roomId && (
        data.roomId === activeAudioCall.roomName ||
        (data.roomId.includes && data.roomId.includes(activeAudioCall.roomName)) ||
        (activeAudioCall.roomName.includes && activeAudioCall.roomName.includes(data.roomId))
      );
      
      if (audioCallMatches) {
        console.log('[GlobalIncomingCall] Closing audio call - caller ended');
        stopCallTimer();
        setActiveAudioCall(null);
        toast({
          title: "Call Ended",
          description: "The other participant ended the call",
        });
      }
    });

    const unsubscribeCallDeclined = socketManager.on('call_declined', (data: any) => {
      console.log('[GlobalIncomingCall] Received call_declined event:', data);
      
      // If we have an incoming call and it matches the declined call, auto-decline and close popup
      closeIncomingCallIfMatch(data);
    });

    return () => {
      unsubscribeCallEnded();
      unsubscribeCallDeclined();
    };
  }, [activeVideoCall, activeAudioCall, incomingCall, stopCallTimer, stopRingtone, clearIncomingCall, toast]);

  const handleAccept = useCallback((callData: IncomingCallData) => {
    console.log('[GlobalIncomingCall] Accepting call, stopping ringtone...');
    stopRingtone();
    
    const callerName = callData.fromUsername || callData.fromUserId || 'Unknown';
    const callerId = callData.fromUserId || '';
    
    startCallTimer();
    
    if (callData.isVideo) {
      setActiveVideoCall({
        roomName: callData.roomId,
        token: callData.token,
        serverUrl: callData.serverUrl,
        callerName: callerName,
        callerId: callerId,
      });
    } else {
      setActiveAudioCall({
        roomName: callData.roomId,
        token: callData.token,
        serverUrl: callData.serverUrl,
        callerName: callerName,
        callerId: callerId,
      });
    }
    
    acceptCall(callData);
  }, [acceptCall, stopRingtone, startCallTimer]);

  const handleDecline = useCallback(() => {
    console.log('[GlobalIncomingCall] Declining call, stopping ringtone...');
    if (incomingCall?.isVideo) stopCameraForIncomingVideoCall();
    stopRingtone();
    stopCallTimer();
    declineCall(); // Emit and clear state
    clearIncomingCall(); // Ensure "Incoming Audio Call" popup closes when user declines (before other party accepts/declines)
  }, [incomingCall, declineCall, clearIncomingCall, stopRingtone, stopCallTimer]);

  const handleTimeout = useCallback(() => {
    console.log('[GlobalIncomingCall] Call timed out, stopping ringtone...');
    if (incomingCall?.isVideo) stopCameraForIncomingVideoCall();
    stopRingtone();
    stopCallTimer();
    clearIncomingCall();
  }, [incomingCall, clearIncomingCall, stopRingtone, stopCallTimer]);

  const handleEndVideoCall = useCallback(() => {
    if (activeVideoCall && user) {
      const myIdentifier = buildSocketUserIdentifier(user);
      
      socketManager.emitToServer('call_ended', {
        roomId: activeVideoCall.roomName,
        initiatorUserId: myIdentifier,
        participantIds: [activeVideoCall.callerId],
      });
      console.log('[GlobalIncomingCall] Emitted call_ended for video call:', activeVideoCall.roomName);
    }
    
    stopCallTimer();
    setActiveVideoCall(null);
  }, [activeVideoCall, user, stopCallTimer]);

  const handleEndAudioCall = useCallback(() => {
    if (activeAudioCall && user) {
      const myIdentifier = buildSocketUserIdentifier(user);
      
      socketManager.emitToServer('call_ended', {
        roomId: activeAudioCall.roomName,
        initiatorUserId: myIdentifier,
        participantIds: [activeAudioCall.callerId],
      });
      console.log('[GlobalIncomingCall] Emitted call_ended for audio call:', activeAudioCall.roomName);
    }
    
    stopCallTimer();
    setActiveAudioCall(null);
  }, [activeAudioCall, user, stopCallTimer]);

  if (!incomingCall && !activeVideoCall && !activeAudioCall) {
    return null;
  }

  return (
    <>
      <IncomingCallModal
        callData={incomingCall}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onTimeout={handleTimeout}
      />

      {activeVideoCall && (
        <Dialog open={!!activeVideoCall} onOpenChange={() => handleEndVideoCall()}>
          <DialogContent className="max-w-none w-screen h-screen p-0 m-0 rounded-none border-none bg-black">
            <DialogHeader className="p-4 border-b absolute top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur">
              <DialogTitle className="text-white flex items-center justify-between gap-4">
                <span>Video Call - {activeVideoCall.callerName}</span>
                <span className="text-sm font-mono bg-white/20 px-2 py-1 rounded">
                  {formatCallDuration(callDuration)}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="w-full h-full pt-16 bg-black">
              <LiveKitVideoCall
                roomName={activeVideoCall.roomName}
                participantName={user ? `${user.firstName} ${user.lastName}` : 'User'}
                participantRole={user?.role}
                token={activeVideoCall.token}
                serverUrl={activeVideoCall.serverUrl}
                onDisconnect={handleEndVideoCall}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeAudioCall && (
        <Dialog open={!!activeAudioCall} onOpenChange={() => handleEndAudioCall()}>
          <DialogContent className="max-w-2xl w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-4">
                <span>Audio Call - {activeAudioCall.callerName}</span>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatCallDuration(callDuration)}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <LiveKitAudioCall
                roomName={activeAudioCall.roomName}
                participantName={user ? `${user.firstName} ${user.lastName}` : 'User'}
                participantRole={user?.role}
                token={activeAudioCall.token}
                serverUrl={activeAudioCall.serverUrl}
                onDisconnect={handleEndAudioCall}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
