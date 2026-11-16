import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { fetchLiveToken } from "./account";
import { Icon } from "./icons";

function cameraPub(room) {
  return [...room.localParticipant.videoTrackPublications.values()].find((pub) => pub.source === Track.Source.Camera);
}

export function LiveStream({ liveId, isHost, cover, focus, onStatus }) {
  const stageRef = useRef(null);
  const roomRef = useRef(null);
  const facingRef = useRef("user");
  const [status, setStatus] = useState("connecting");
  const [message, setMessage] = useState("Connecting…");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    onStatus?.(status, message);
  }, [status, message, onStatus]);

  useEffect(() => {
    if (!liveId) return undefined;
    let dead = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        facingMode: "user",
      },
    });
    roomRef.current = room;

    const mount = (track, local = false, mirror = local) => {
      const stage = stageRef.current;
      if (!stage || track.kind !== Track.Kind.Video) return;
      stage.querySelectorAll("video").forEach((node) => node.remove());
      const el = track.attach();
      el.playsInline = true;
      el.muted = local;
      el.autoplay = true;
      el.className = mirror ? "room-video mirror" : "room-video";
      stage.appendChild(el);
    };

    const clearVideo = () => {
      stageRef.current?.querySelectorAll("video").forEach((node) => node.remove());
    };

    const onSubscribed = (track) => {
      if (track.kind === Track.Kind.Audio) {
        track.attach();
        return;
      }
      if (track.kind === Track.Kind.Video) {
        mount(track, false, false);
        setStatus("live");
        setMessage("");
      }
    };

    const onUnsubscribed = (track) => {
      track.detach();
      if (track.kind === Track.Kind.Video && !isHost) {
        clearVideo();
        setStatus("waiting");
        setMessage("Waiting for the host's camera…");
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.TrackMuted, (pub) => {
        if (!isHost && pub.kind === Track.Kind.Video) {
          clearVideo();
          setStatus("waiting");
          setMessage("Host turned the camera off");
        }
      })
      .on(RoomEvent.TrackUnmuted, (pub) => {
        if (!isHost && pub.kind === Track.Kind.Video && pub.track) {
          mount(pub.track, false, false);
          setStatus("live");
          setMessage("");
        }
      })
      .on(RoomEvent.Disconnected, () => {
        if (!dead) {
          setStatus("ended");
          setMessage("Stream disconnected");
        }
      });

    (async () => {
      try {
        const { token, url } = await fetchLiveToken(liveId);
        if (dead) return;
        await room.connect(url, token);
        if (dead) return;

        if (isHost) {
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true);
          const cam = cameraPub(room)?.track;
          if (cam) mount(cam, true, facingRef.current === "user");
          setStatus("live");
          setMessage("");
          setMicOn(true);
          setCamOn(true);
        } else {
          const remote = [...room.remoteParticipants.values()][0];
          const video = remote && [...remote.videoTrackPublications.values()].find((pub) => pub.track)?.track;
          if (video) {
            mount(video, false, false);
            setStatus("live");
            setMessage("");
          } else {
            setStatus("waiting");
            setMessage("Waiting for the host's camera…");
          }
          remote?.audioTrackPublications.forEach((pub) => pub.track?.attach());
        }
      } catch (error) {
        if (dead) return;
        setStatus("error");
        const raw = error.message || "Couldn't start the camera";
        setMessage(
          /invalid token/i.test(raw)
            ? "Camera keys look wrong. Recreate a LiveKit key and update LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET on Vercel, then redeploy."
            : raw,
        );
      }
    })();

    return () => {
      dead = true;
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
      clearVideo();
    };
  }, [liveId, isHost]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room || !isHost) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room || !isHost) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
    if (!next) {
      stageRef.current?.querySelectorAll("video").forEach((node) => node.remove());
      return;
    }
    const cam = cameraPub(room)?.track;
    if (!cam) return;
    stageRef.current?.querySelectorAll("video").forEach((node) => node.remove());
    const el = cam.attach();
    el.playsInline = true;
    el.muted = true;
    el.autoplay = true;
    el.className = facingRef.current === "user" ? "room-video mirror" : "room-video";
    stageRef.current?.appendChild(el);
  };

  const flipCam = async () => {
    const room = roomRef.current;
    const pub = room && isHost && camOn ? cameraPub(room) : null;
    if (!pub?.track) return;
    const next = facingRef.current === "user" ? "environment" : "user";
    try {
      await pub.track.restartTrack({ facingMode: next });
      facingRef.current = next;
      stageRef.current?.querySelectorAll("video").forEach((node) => {
        node.className = next === "user" ? "room-video mirror" : "room-video";
      });
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
