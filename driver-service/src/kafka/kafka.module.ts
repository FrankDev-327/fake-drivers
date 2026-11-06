import { Module } from "@nestjs/common";
import { KafkaProducer } from "./kafka.service";
import { KafkaConsumer } from "./kafka.consumer";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [MetricsModule],
  providers: [KafkaProducer, KafkaConsumer],
  exports: [KafkaProducer, KafkaConsumer],
})
export class KafkaModule {}
