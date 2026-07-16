import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { LoginDto } from "./dto/login.dto";
import logger from "../../looger";
import { UsersService } from "../users/users.service";
import { MetricsService } from "../metrics/metrics.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly metricsService: MetricsService,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string }> {
    try {
      const user = await this.usersService.findByEmail(dto.email);

      if (!user) {
        this.metricsService.httpRequestsTotal.inc({
          method: "POST",
          route: "/auth/login",
          status_code: "401",
        });
        throw new UnauthorizedException("Invalid credentials");
      }

      const passwordValid = await bcrypt.compare(dto.password, user.password);

      if (!passwordValid) {
        this.metricsService.httpRequestsTotal.inc({
          method: "POST",
          route: "/auth/login",
          status_code: "401",
        });
        throw new UnauthorizedException("Invalid credentials");
      }

      this.metricsService.httpRequestsTotal.inc({
        method: "POST",
        route: "/auth/login",
        status_code: "200",
      });

      logger.info("User logged in", { userId: user.id });

      const token = await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return { token };
    } catch (error) {
      logger.error("Failed to login user", {
        error: (error as Error).message,
        email: dto.email,
      });

      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException("Invalid credentials");
      }

      this.metricsService.httpRequestsTotal.inc({
        method: "POST",
        route: "/auth/login",
        status_code: "500",
      });

      throw new InternalServerErrorException("Failed to login");
    }
  }
}
