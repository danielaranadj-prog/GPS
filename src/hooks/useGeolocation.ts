import { useState, useEffect, useRef, useCallback } from 'react';
import type { GpsBreadcrumb, DeviationStatus } from '../types';
import { analyzePointDeviation, calculatePolylineDistance } from '../services/auditor';
import { feedbackService } from '../services/sound';

interface GeolocationHookProps {
  officialPath: [number, number][];
}

export function useGeolocation({ officialPath }: GeolocationHookProps) {
  const [position, setPosition] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
  }>({
    // Default to Tepic Downtown Plaza Principal
    lat: 21.5095,
    lng: -104.8957,
    accuracy: 3.2,
    speed: 0,
    heading: 0,
  });

  const [hasRealGps, setHasRealGps] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState<GpsBreadcrumb[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Simulation mode for Desktop testing / Demo
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationStepRef = useRef(0);
  const simulationTimerRef = useRef<number | null>(null);

  // Deviation state
  const [deviationStatus, setDeviationStatus] = useState<DeviationStatus>({
    isDeviated: false,
    currentDistanceMeters: 0,
    maxDistanceMeters: 0,
    accumulatedDistanceMeters: 0,
    deviationPoints: [],
  });

  const lastPointRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const deviationPointsRef = useRef<[number, number][]>([]);
  const wasDeviatedRef = useRef(false);

  // Process incoming GPS coordinate
  const handleNewCoordinate = useCallback((
    lat: number,
    lng: number,
    accuracy: number,
    speed: number | null,
    heading: number | null
  ) => {
    const now = Date.now();
    setPosition({ lat, lng, accuracy, speed, heading });

    // Check deviation against official polyline
    const analysis = analyzePointDeviation({ lat, lng }, officialPath);

    if (analysis.isDeviated) {
      if (!wasDeviatedRef.current && (isRecording || isSimulating)) {
        // Just started deviating while recording or simulating
        feedbackService.playWarning();
      }
      wasDeviatedRef.current = true;
      deviationPointsRef.current.push([lat, lng]);

      const accumulated = calculatePolylineDistance(deviationPointsRef.current);
      setDeviationStatus(prev => ({
        isDeviated: true,
        currentDistanceMeters: analysis.distanceFromOfficialMeters,
        maxDistanceMeters: Math.max(prev.maxDistanceMeters, analysis.distanceFromOfficialMeters),
        accumulatedDistanceMeters: accumulated > 0 ? accumulated : analysis.distanceFromOfficialMeters,
        deviationPoints: [...deviationPointsRef.current],
        startPoint: prev.startPoint || { lat, lng },
      }));
    } else {
      if (wasDeviatedRef.current) {
        // Re-entered official corridor
        wasDeviatedRef.current = false;
      }
      // Reset active deviation alert if back on track
      setDeviationStatus(prev => ({
        ...prev,
        isDeviated: false,
        currentDistanceMeters: analysis.distanceFromOfficialMeters,
      }));
    }

    // If recording track, record points with filter (min 2s or min 4 meters)
    if (isRecording) {
      let shouldRecord = false;
      if (!lastPointRef.current) {
        shouldRecord = true;
      } else {
        const timeDiff = now - lastPointRef.current.time;
        // Approximation: 0.00004 deg is ~4.4 meters
        const dLat = Math.abs(lat - lastPointRef.current.lat);
        const dLng = Math.abs(lng - lastPointRef.current.lng);
        const approxDist = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;

        if (timeDiff >= 2000 || approxDist >= 4) {
          shouldRecord = true;
        }
      }

      if (shouldRecord) {
        lastPointRef.current = { lat, lng, time: now };
        const breadcrumb: GpsBreadcrumb = {
          lat,
          lng,
          accuracy,
          speed,
          heading,
          timestamp: now,
          distanceFromOfficial: analysis.distanceFromOfficialMeters,
          isDeviation: analysis.isDeviated,
        };
        setRecordedPoints(prev => [...prev, breadcrumb]);
      }
    }
  }, [officialPath, isRecording]);

  // Real device Geolocation watcher
  useEffect(() => {
    if (isSimulating) return;

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported by this browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setHasRealGps(true);
        handleNewCoordinate(
          pos.coords.latitude,
          pos.coords.longitude,
          Math.round(pos.coords.accuracy || 4),
          pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
          pos.coords.heading || null
        );
      },
      (err) => {
        console.warn('GPS position error:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [handleNewCoordinate, isSimulating]);

  // Simulation loop (for desktop testing or field rehearsal)
  useEffect(() => {
    if (!isSimulating) {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      return;
    }

    // Generate a test itinerary starting from Tepic Downtown, going through Av México, then taking a 650m detour into a neighborhood
    const simulationTrajectory: [number, number][] = [
      [21.5034, -104.8912],
      [21.5060, -104.8935],
      [21.5095, -104.8957], // Center
      [21.5140, -104.8920],
      // Detour begins (bus diverted off official corridor into Colonia San Antonio)
      [21.5145, -104.8860], // +620m off official
      [21.5160, -104.8810], // +950m off official
      [21.5190, -104.8770], // +1200m off official
      // Detour returns
      [21.5220, -104.8710],
      [21.5285, -104.8620], // Terminal Suchiate
    ];

    simulationTimerRef.current = window.setInterval(() => {
      const idx = simulationStepRef.current % simulationTrajectory.length;
      const [simLat, simLng] = simulationTrajectory[idx];

      // Add a tiny random jitter for realistic GPS accuracy
      const jitterLat = simLat + (Math.random() - 0.5) * 0.0001;
      const jitterLng = simLng + (Math.random() - 0.5) * 0.0001;
      const accuracy = 2.5 + Math.random() * 2;

      handleNewCoordinate(jitterLat, jitterLng, accuracy, 28, 45);
      simulationStepRef.current += 1;
    }, 2500);

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [isSimulating, handleNewCoordinate]);

  const startRecording = useCallback(() => {
    feedbackService.playToggle(true);
    setRecordedPoints([]);
    lastPointRef.current = null;
    deviationPointsRef.current = [];
    setRecordingStartTime(Date.now());
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    feedbackService.playToggle(false);
    setIsRecording(false);
  }, []);

  const clearRecording = useCallback(() => {
    setRecordedPoints([]);
    setRecordingStartTime(null);
    deviationPointsRef.current = [];
    setDeviationStatus({
      isDeviated: false,
      currentDistanceMeters: 0,
      maxDistanceMeters: 0,
      accumulatedDistanceMeters: 0,
      deviationPoints: [],
    });
  }, []);

  const clearDeviation = useCallback(() => {
    deviationPointsRef.current = [];
    wasDeviatedRef.current = false;
    setDeviationStatus({
      isDeviated: false,
      currentDistanceMeters: 0,
      maxDistanceMeters: 0,
      accumulatedDistanceMeters: 0,
      deviationPoints: [],
    });
  }, []);

  const toggleSimulation = useCallback(() => {
    setIsSimulating(prev => !prev);
  }, []);

  const totalRecordedDistanceMeters = calculatePolylineDistance(
    recordedPoints.map(p => [p.lat, p.lng])
  );

  return {
    position,
    hasRealGps,
    isRecording,
    recordedPoints,
    recordingStartTime,
    totalRecordedDistanceMeters,
    startRecording,
    stopRecording,
    clearRecording,
    clearDeviation,
    deviationStatus,
    isSimulating,
    toggleSimulation,
  };
}
