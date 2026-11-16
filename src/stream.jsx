import { useEffect, useRef, useState } from "react";
import { fetchLiveToken } from "./account";
import { Icon } from "./icons";

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function mountLocalVideo(stage, stream, mirror) {
  if (!stage || !stream) return null;
  stage.querySelectorAll("video").forEach((node) => {
    node.srcObject = null;
    node.remove();
  });
  const el = document.createElement("video");
  el.playsInline = true;
  el.muted = true;
  el.autoplay = true;
  el.srcObject = stream;
  el.className = mirror ? "room-video mirror" : "room-video";
  stage.appendChild(el);
  el.play().catch(() => {});
  return el;
}

export function LiveStream({ liveId, isHost, cover, focus }) {
  const stageRef = useRef(null);
  const streamRef = useRef(null);
  const roomRef = useRef(null);
  const facingRef = useRef("user");
  const [status, setStatus] = useState(isHost ? "starting" : "waiting");
  const [message, setMessage] = useState(isHost ? "Opening camera…" : "Waiting for the host…");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (!liveId) return undefined;
    let dead = false;

    const clearVideo = () => {
      stageRef.current?.querySelectorAll("video, audio").forEach((node) => {
        node.srcObject = null;
        node.remove();
      });
    };

    const openLocalCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: facingRef.current,
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
      });
      if (dead) {
        stopStream(stream);
        return null;
      }
      streamRef.current = stream;
      mountLocalVideo(stageRef.current, stream, facingRef.current === "user");
      setMicOn(true);
      setCamOn(true);
      setStatus("live");
      setMessage("");
      return stream;
    };

    const tryLiveKit = async (localStream) => {
      try {
        const { Room, RoomEvent, Track } = await import("livekit-client");
        const { token, url } = await fetchLiveToken(liveId);
        if (dead) return;

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        if (!isHost) {
          room.on(RoomEvent.TrackSubscribed, (track) => {
            if (dead) return;
            if (track.kind === Track.Kind.Audio) {
              track.attach();
              return;
            }
            if (track.kind !== Track.Kind.Video) return;
            const stage = stageRef.current;
            if (!stage) return;
            stage.querySelectorAll("video").forEach((node) => node.remove());
            const el = track.attach();
            el.playsInline = true;
            el.autoplay = true;
            el.className = "room-video";
            stage.appendChild(el);
            setStatus("live");
            setMessage("");
          });
          room.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach();
            if (track.kind === Track.Kind.Video) {
              clearVideo();
              setStatus("waiting");
              setMessage("Waiting for the host…");
            }
          });
        }

        await room.connect(url, token);
        if (dead) {
          room.disconnect();
          return;
        }

        if (isHost && localStream) {
          const video = localStream.getVideoTracks()[0];
          const audio = localStream.getAudioTracks()[0];
          if (video) await room.localParticipant.publishTrack(video);
          if (audio) await room.localParticipant.publishTrack(audio);
        } else if (!isHost) {
          const remote = [...room.remoteParticipants.values()][0];
          const video = remote && [...remote.videoTrackPublications.values()].find((pub) => pub.track)?.track;
          if (video) {
            const stage = stageRef.current;
            if (stage) {
              stage.querySelectorAll("video").forEach((node) => node.remove());
              const el = video.attach();
              el.playsInline = true;
              el.autoplay = true;
              el.className = "room-video";
              stage.appendChild(el);
            }
            setStatus("live");
            setMessage("");
          }
          remote?.audioTrackPublications.forEach((pub) => pub.track?.attach());
        }
      } catch {
        // Local camera still works for the host even if remote streaming isn't ready.
        if (!isHost && !dead) {
          setStatus("waiting");
          setMessage("Waiting for the host…");
        }
      }
    };

    (async () => {
      try {
        if (isHost) {
          if (!navigator.mediaDevices?.getUserMedia) {
            setStatus("error");
            setMessage("Camera needs HTTPS on your phone or laptop.");
            return;
          }
          const local = await openLocalCamera();
          if (!dead) await tryLiveKit(local);
        } else {
          setStatus("waiting");
          setMessage("Waiting for the host…");
          await tryLiveKit(null);
        }
      } catch (error) {
        if (dead) return;
        if (isHost) {
          setStatus("error");
          setMessage(
            /NotAllowed|Permission/i.test(error.name || error.message || "")
              ? "Allow camera and mic, then try again."
              : error.message || "Couldn't open the camera",
          );
        } else {
          setStatus("waiting");
          setMessage("Waiting for the host…");
        }
      }
    })();

    return () => {
      dead = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      clearVideo();
    };
  }, [liveId, isHost]);

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track || !isHost) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !isHost) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
    if (!track.enabled) {
      stageRef.current?.querySelectorAll("video").forEach((node) => node.remove());
    } else {
      mountLocalVideo(stageRef.current, streamRef.current, facingRef.current === "user");
    }
  };

  const flipCam = async () => {
    if (!isHost || !camOn || !navigator.mediaDevices?.getUserMedia) return;
    const next = facingRef.current === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { ideal: next },
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
      });
      stopStream(streamRef.current);
      streamRef.current = stream;
      facingRef.current = next;
      mountLocalVideo(stageRef.current, stream, next === "user");
      setMicOn(true);
      setCamOn(true);

      const room = roomRef.current;
      if (room) {
        try {
          const { Track } = await import("livekit-client");
          const oldVideo = [...room.localParticipant.videoTrackPublications.values()].find((pub) => pub.source === Track.Source.Camera);
          const oldAudio = [...room.localParticipant.audioTrackPublications.values()].find((pub) => pub.source === Track.Source.Microphone);
          if (oldVideo?.track) await room.localParticipant.unpublishTrack(oldVideo.track);
          if (oldAudio?.track) await room.localParticipant.unpublishTrack(oldAudio.track);
          const video = stream.getVideoTracks()[0];
          const audio = stream.getAudioTracks()[0];
          if (video) await room.localParticipant.publishTrack(video);
          if (audio) await room.localParticipant.publishTrack(audio);
        } catch {
          // Keep local preview even if republish fails.
        }
      }
    } catch {
      setMessage("Couldn't flip the camera");
    }
  };

  return (
    <>
      <div className="room-stage" ref={stageRef}>
        {cover ? (
          <img className="room-photo" src={cover} alt="" referrerPolicy="no-referrer" style={{ objectPosition: focus }} />
        ) : (
          <span className="live-fallback" />
        )}
      </div>
      {status !== "live" && message && (
        <div className="stream-status">
          <span>{message}</span>
        </div>
      )}
      {isHost && status === "live" && (
        <div className="stream-controls" onClick={(event) => event.stopPropagation()}>
          <button type="button" className={micOn ? "" : "off"} aria-label={micOn ? "Mute mic" : "Unmute mic"} onClick={toggleMic}>
            <Icon name={micOn ? "mic" : "mic-off"} size={18} />
          </button>
          <button type="button" className={camOn ? "" : "off"} aria-label={camOn ? "Turn camera off" : "Turn camera on"} onClick={toggleCam}>
            <Icon name={camOn ? "cam" : "cam-off"} size={18} />
          </button>
          <button type="button" aria-label="Flip camera" onClick={flipCam} disabled={!camOn}>
            <Icon name="flip" size={18} />
          </button>
        </div>
      )}
    </>
  );
}
