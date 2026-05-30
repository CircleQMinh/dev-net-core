import { useEffect } from "react";
import { useAppDispatch } from "../lib/redux/hooks/hooks";
import { setSimulationStep } from "../lib/redux/slices/simulationSlice";

export default function SimulationResult() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setSimulationStep("result"));
  }, [dispatch]);

  return <p>SimulationResult</p>;
}
