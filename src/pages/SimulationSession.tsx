import { useEffect } from "react";
import { useAppDispatch } from "../lib/redux/hooks/hooks";
import { setSimulationStep } from "../lib/redux/slices/simulationSlice";

export default function SimulationSession() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setSimulationStep("session"));
  }, [dispatch]);

  return <p>SimulationSession</p>;
}
