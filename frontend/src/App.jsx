import React, { useRef, useState } from "react";
import {
  Button,
  Container,
  Typography,
  Paper,
  Box,
  CssBaseline,
} from "@mui/material";

const App = () => {
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);

  const SERVER_URL = "ws://localhost:8000/ws/stt";

  const startRecording = async () => {
    wsRef.current = new WebSocket(SERVER_URL);
    wsRef.current.binaryType = "arraybuffer";

    wsRef.current.onmessage = (event) => {
      setTranscript((prev) => prev + " " + event.data);
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    audioContextRef.current = audioContext;

    await audioContext.audioWorklet.addModule("/recorderProcessor.js");

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, "recorderProcessor");
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (event) => {
      const input = event.data;
      const buffer = new ArrayBuffer(input.length * 2);
      const view = new DataView(buffer);

      for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(buffer);
      }
    };

    source.connect(workletNode).connect(audioContext.destination);
    setIsRecording(true);
  };

  const stopRecording = () => {
    wsRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    workletNodeRef.current?.disconnect();
    audioContextRef.current?.close();

    setIsRecording(false);
  };

  return (
    <>
      <CssBaseline />
      <Container maxWidth="sm">
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          <Typography variant="h4" gutterBottom align="center">
            Nhận dạng giọng nói tiếng Việt
          </Typography>

          <Button
            variant="contained"
            color={isRecording ? "error" : "success"}
            onClick={isRecording ? stopRecording : startRecording}
            sx={{ mb: 3 }}
          >
            {isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
          </Button>

          <Paper elevation={3} sx={{ p: 2, width: "100%", minHeight: 100 }}>
            <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
              {transcript || "Chưa có văn bản nào..."}
            </Typography>
          </Paper>
        </Box>
      </Container>
    </>
  );
};

export default App;